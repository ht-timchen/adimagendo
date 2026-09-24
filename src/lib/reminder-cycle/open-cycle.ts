import { computeReminderDueDates as computeMedicalDueDates } from "@/lib/medical-appointments-reminder/intervals";
import { computeReminderDueDates as computeSchoolDueDates } from "@/lib/school-attendance-reminder/intervals";
import { medicalPeriodKey, schoolPeriodKey } from "./period-key";
import { isWithinPushWindow } from "./visibility";

/** Migrated school rows keep Friday 17:00 and are stamped 1. New rows use 16:30. */
export const SCHOOL_SCHEDULE_VERSION = 2;
export const MEDICAL_SCHEDULE_VERSION = 1;

export type OpenReminderCycle = {
  reminder1At: Date;
  reminder2At: Date;
  reminder3At: Date;
  cycleEndAt: Date;
  periodKey: string;
  scheduleVersion: number;
};

function fromDueDates(
  due: {
    initialDueAt: Date;
    firstFollowUpDueAt: Date;
    secondFollowUpDueAt: Date;
    cycleEndAt: Date;
  },
  periodKey: string,
  scheduleVersion: number
): OpenReminderCycle {
  return {
    reminder1At: due.initialDueAt,
    reminder2At: due.firstFollowUpDueAt,
    reminder3At: due.secondFollowUpDueAt,
    cycleEndAt: due.cycleEndAt,
    periodKey,
    scheduleVersion,
  };
}

/** The school cycle whose R1 window contains `now`, or null outside that hour. */
export function openSchoolCycle(now: Date): OpenReminderCycle | null {
  const due = computeSchoolDueDates(now);
  if (!isWithinPushWindow(due.initialDueAt, now)) return null;
  return fromDueDates(
    due,
    schoolPeriodKey(due.initialDueAt),
    SCHOOL_SCHEDULE_VERSION
  );
}

/** The medical cycle whose R1 window contains `now`, or null outside that hour. */
export function openMedicalCycle(now: Date): OpenReminderCycle | null {
  const due = computeMedicalDueDates(now);
  if (!isWithinPushWindow(due.initialDueAt, now)) return null;
  return fromDueDates(
    due,
    medicalPeriodKey(due.initialDueAt),
    MEDICAL_SCHEDULE_VERSION
  );
}
