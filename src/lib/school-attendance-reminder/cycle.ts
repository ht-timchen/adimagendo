import {
  dismissReminder,
  getReminderBannerState,
  processDueReminders,
  respondToReminder,
  type ProcessDueRemindersResult,
  type ReminderBannerState,
} from "@/lib/reminder-cycle/process";

export type { ProcessDueRemindersResult };
export type SchoolAttendanceBannerState = ReminderBannerState;

export function getSchoolAttendanceBannerState(
  userId: string,
  now = new Date()
): Promise<SchoolAttendanceBannerState | null> {
  return getReminderBannerState("school_attendance", userId, now);
}

export function dismissSchoolAttendanceReminder(
  cycleId: string,
  userId: string,
  now = new Date()
): Promise<boolean> {
  return dismissReminder("school_attendance", cycleId, userId, now);
}

export function respondSchoolAttendanceReminder(params: {
  cycleId: string;
  userId: string;
  action: "yes" | "no";
  now?: Date;
}): Promise<"YES" | "NO"> {
  return respondToReminder({ ...params, reminderType: "school_attendance" });
}

export function processDueSchoolAttendanceReminders(
  now = new Date()
): Promise<ProcessDueRemindersResult> {
  return processDueReminders("school_attendance", now);
}
