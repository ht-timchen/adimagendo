import type { Session } from "next-auth";
import { prisma } from "@/lib/db";
import { ADMIN_AUDIT_ACTIONS, createAdminAuditEventInTx } from "@/lib/admin-audit";
import { isTestParticipantForTiming } from "@/lib/checklist/enrollment-date-for-timing";
import {
  addCalendarMonths,
  adelaideCivilDate,
  adelaideNoonUtc,
  compareCivilDates,
  formatAdelaideCivilDate,
  parseCivilDateYmd,
  type CivilDate,
} from "@/lib/dates/adelaide-calendar";
import type { ClassificationChangeReasonInput } from "./classification-change-reason";
import {
  auditDateValue,
  CLASSIFICATION_CONFLICT_MESSAGE,
  classificationAuditMetadata,
  classificationChangeFailure,
  ClassificationConflictError,
  loadParticipantForClassificationChange,
  type ClassificationChangeFailure,
} from "./classification-change-common";

export const TEST_ENROLMENT_DATE_TOOLS_ENV = "ENABLE_TEST_ENROLMENT_DATE_TOOLS";

export const DAY0_FROM_CONSENT_MESSAGE = "Day 0 comes from the REDCap consent date";

export const TEST_ENROLMENT_DATE_TOOLS_DISABLED_MESSAGE =
  "Test enrolment date tools are disabled in this environment.";

export const TEST_ENROLLMENT_DATE_MIN: CivilDate = { year: 2020, month: 1, day: 1 };

export function isTestEnrollmentDateToolsEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env[TEST_ENROLMENT_DATE_TOOLS_ENV] === "true";
}

/** Latest allowed test Day 0: today + 1 year (Adelaide calendar date). */
export function testEnrollmentDateMax(now: Date): CivilDate {
  return addCalendarMonths(adelaideCivilDate(now), 12);
}

/** Stored value for a chosen Day 0: 12:00 Adelaide time on that calendar date. */
export function testEnrollmentDateToStoredInstant(date: CivilDate): Date {
  return adelaideNoonUtc(date);
}

export type SetTestEnrollmentDateContext = {
  userId: string;
  session: Session;
  /** "YYYY-MM-DD" Adelaide calendar date. */
  date: unknown;
  reason: ClassificationChangeReasonInput;
  now?: Date;
  env?: Record<string, string | undefined>;
};

export type SetTestEnrollmentDateResult =
  | {
      ok: true;
      userId: string;
      previousEnrollmentDate: Date;
      nextEnrollmentDate: Date;
    }
  | ClassificationChangeFailure;

/**
 * Updates ParticipantProfile.enrollmentDate for a test account only.
 * REDCap sync data is never read or written here.
 */
export async function setTestEnrollmentDate(
  ctx: SetTestEnrollmentDateContext
): Promise<SetTestEnrollmentDateResult> {
  if (!isTestEnrollmentDateToolsEnabled(ctx.env)) {
    return classificationChangeFailure(
      "feature_disabled",
      TEST_ENROLMENT_DATE_TOOLS_DISABLED_MESSAGE
    );
  }

  const loaded = await loadParticipantForClassificationChange({
    session: ctx.session,
    userId: ctx.userId,
    reason: ctx.reason,
    action: "edit_test_enrollment_date",
    permission: "participant:classify",
  });
  if (!loaded.ok) return loaded;
  const { profile } = loaded;

  if (!isTestParticipantForTiming(profile)) {
    return classificationChangeFailure("not_eligible", DAY0_FROM_CONSENT_MESSAGE);
  }

  const chosen = typeof ctx.date === "string" ? parseCivilDateYmd(ctx.date) : null;
  if (!chosen) {
    return classificationChangeFailure("invalid_date", "Enter a valid date.");
  }
  const max = testEnrollmentDateMax(ctx.now ?? new Date());
  if (
    compareCivilDates(chosen, TEST_ENROLLMENT_DATE_MIN) < 0 ||
    compareCivilDates(chosen, max) > 0
  ) {
    return classificationChangeFailure(
      "invalid_date",
      `Choose a date between ${formatAdelaideCivilDate(TEST_ENROLLMENT_DATE_MIN)} and ${formatAdelaideCivilDate(max)}.`
    );
  }
  if (compareCivilDates(chosen, adelaideCivilDate(profile.enrollmentDate)) === 0) {
    return classificationChangeFailure(
      "unchanged",
      "This is already the enrolment date for this account."
    );
  }

  const nextEnrollmentDate = testEnrollmentDateToStoredInstant(chosen);

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.participantProfile.updateMany({
        where: {
          id: profile.id,
          dataSource: profile.dataSource,
          dataKind: profile.dataKind,
          enrollmentDate: profile.enrollmentDate,
        },
        data: { enrollmentDate: nextEnrollmentDate },
      });
      if (updated.count !== 1) throw new ClassificationConflictError();

      await createAdminAuditEventInTx(tx, {
        session: ctx.session,
        action: ADMIN_AUDIT_ACTIONS.PARTICIPANT_TEST_ENROLLMENT_DATE_CHANGED,
        targetType: "participant",
        targetId: loaded.userId,
        targetName: profile.studyRecordId,
        metadata: classificationAuditMetadata({
          studyRecordId: profile.studyRecordId,
          field: "enrollmentDate",
          from: auditDateValue(profile.enrollmentDate),
          to: auditDateValue(nextEnrollmentDate),
          reason: loaded.reason,
          extra: { dataSource: profile.dataSource, dataKind: profile.dataKind },
        }),
      });
    });
  } catch (e) {
    if (e instanceof ClassificationConflictError) {
      return classificationChangeFailure("conflict", CLASSIFICATION_CONFLICT_MESSAGE);
    }
    throw e;
  }

  return {
    ok: true,
    userId: loaded.userId,
    previousEnrollmentDate: profile.enrollmentDate,
    nextEnrollmentDate,
  };
}
