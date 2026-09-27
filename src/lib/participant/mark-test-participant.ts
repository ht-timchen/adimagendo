import type { Session } from "next-auth";
import { prisma } from "@/lib/db";
import { ADMIN_AUDIT_ACTIONS, createAdminAuditEventInTx } from "@/lib/admin-audit";
import { getRedcapConsentEnrollmentDate } from "@/lib/checklist/resolve-enrollment-date";
import { resolveEnrollmentDateForTiming } from "@/lib/checklist/enrollment-date-for-timing";
import {
  PARTICIPANT_DATA_KIND,
  PARTICIPANT_DATA_SOURCE,
} from "./participant-classification-values";
import { isDummyRedcapStudyRecordId } from "./participant-data-classification";
import type {
  ClassificationChangeReason,
  ClassificationChangeReasonInput,
} from "./classification-change-reason";
import {
  auditDateValue,
  CLASSIFICATION_CONFLICT_MESSAGE,
  classificationAuditMetadata,
  classificationChangeFailure,
  ClassificationConflictError,
  loadParticipantForClassificationChange,
  type ClassificationChangeFailure,
  type ClassificationChangeProfile,
  type ParticipantClassificationSnapshot,
} from "./classification-change-common";

export type TestClassificationContext = {
  userId: string;
  session: Session;
  reason: ClassificationChangeReasonInput;
};

export type TestClassificationResult =
  | {
      ok: true;
      userId: string;
      previous: ParticipantClassificationSnapshot;
      next: ParticipantClassificationSnapshot;
      previousEnrollmentDate: Date;
      nextEnrollmentDate: Date;
    }
  | ClassificationChangeFailure;

export const MARK_TEST_NOT_ELIGIBLE_MESSAGE =
  "Only REDCap participants with Unknown classification can be marked as test.";
export const MARK_TEST_PILOT_MESSAGE = "A pilot participant cannot be marked as test.";
export const UNMARK_TEST_NOT_ELIGIBLE_MESSAGE =
  "Only REDCap participants classified as test can be changed back to Unknown.";
export const UNMARK_TEST_DUMMY_RECORD_MESSAGE =
  "Records whose ID starts with TEST are always test records.";

async function applyTestClassificationChange(input: {
  session: Session;
  userId: string;
  profile: ClassificationChangeProfile;
  reason: ClassificationChangeReason;
  next: ParticipantClassificationSnapshot;
  nextEnrollmentDate: Date;
  action: string;
}): Promise<TestClassificationResult> {
  const { profile } = input;
  const previous: ParticipantClassificationSnapshot = {
    dataSource: profile.dataSource,
    dataKind: profile.dataKind,
  };
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.participantProfile.updateMany({
        where: {
          id: profile.id,
          dataSource: previous.dataSource,
          dataKind: previous.dataKind,
          enrollmentDate: profile.enrollmentDate,
        },
        data: {
          dataKind: input.next.dataKind,
          enrollmentDate: input.nextEnrollmentDate,
        },
      });
      if (updated.count !== 1) throw new ClassificationConflictError();

      await createAdminAuditEventInTx(tx, {
        session: input.session,
        action: input.action,
        targetType: "participant",
        targetId: input.userId,
        targetName: profile.studyRecordId,
        metadata: classificationAuditMetadata({
          studyRecordId: profile.studyRecordId,
          field: "dataKind",
          from: previous.dataKind,
          to: input.next.dataKind,
          reason: input.reason,
          extra: {
            enrollmentDate: {
              from: auditDateValue(profile.enrollmentDate),
              to: auditDateValue(input.nextEnrollmentDate),
              changed:
                profile.enrollmentDate.getTime() !== input.nextEnrollmentDate.getTime(),
            },
          },
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
    userId: input.userId,
    previous,
    next: input.next,
    previousEnrollmentDate: profile.enrollmentDate,
    nextEnrollmentDate: input.nextEnrollmentDate,
  };
}

/**
 * REDCAP + UNKNOWN → REDCAP + TEST. Test accounts take Day 0 from the profile,
 * so the Day 0 the account was already using is written to the profile first
 * and no checklist date moves.
 */
export async function markParticipantAsTest(
  ctx: TestClassificationContext
): Promise<TestClassificationResult> {
  const loaded = await loadParticipantForClassificationChange({
    ...ctx,
    action: "mark_test",
    permission: "participant:classify",
  });
  if (!loaded.ok) return loaded;
  const { profile } = loaded;

  if (profile.dataKind === PARTICIPANT_DATA_KIND.REAL) {
    return classificationChangeFailure("not_eligible", MARK_TEST_PILOT_MESSAGE);
  }
  if (profile.dataSource !== PARTICIPANT_DATA_SOURCE.REDCAP) {
    return classificationChangeFailure("not_eligible", MARK_TEST_NOT_ELIGIBLE_MESSAGE);
  }
  if (profile.dataKind === PARTICIPANT_DATA_KIND.TEST) {
    return classificationChangeFailure(
      "unchanged",
      "This participant is already classified as test."
    );
  }

  const currentDay0 = await resolveEnrollmentDateForTiming(profile);

  return applyTestClassificationChange({
    session: ctx.session,
    userId: loaded.userId,
    profile,
    reason: loaded.reason,
    next: {
      dataSource: PARTICIPANT_DATA_SOURCE.REDCAP,
      dataKind: PARTICIPANT_DATA_KIND.TEST,
    },
    nextEnrollmentDate: currentDay0.enrollmentDate ?? profile.enrollmentDate,
    action: ADMIN_AUDIT_ACTIONS.PARTICIPANT_MARKED_TEST,
  });
}

/**
 * REDCAP + TEST → REDCAP + UNKNOWN (undo a mistaken Mark as test). The profile
 * date goes back to the synced consent date so no test date is left behind.
 */
export async function unmarkTestParticipant(
  ctx: TestClassificationContext
): Promise<TestClassificationResult> {
  const loaded = await loadParticipantForClassificationChange({
    ...ctx,
    action: "unmark_test",
    permission: "participant:classify",
  });
  if (!loaded.ok) return loaded;
  const { profile } = loaded;

  if (
    profile.dataSource !== PARTICIPANT_DATA_SOURCE.REDCAP ||
    profile.dataKind === PARTICIPANT_DATA_KIND.REAL
  ) {
    return classificationChangeFailure("not_eligible", UNMARK_TEST_NOT_ELIGIBLE_MESSAGE);
  }
  if (profile.dataKind === PARTICIPANT_DATA_KIND.UNKNOWN) {
    return classificationChangeFailure(
      "unchanged",
      "This participant is already classified as Unknown."
    );
  }
  if (isDummyRedcapStudyRecordId(profile.studyRecordId)) {
    return classificationChangeFailure("not_eligible", UNMARK_TEST_DUMMY_RECORD_MESSAGE);
  }

  const syncedConsentDate = profile.studyRecordId
    ? await getRedcapConsentEnrollmentDate(profile.studyRecordId)
    : null;

  return applyTestClassificationChange({
    session: ctx.session,
    userId: loaded.userId,
    profile,
    reason: loaded.reason,
    next: {
      dataSource: PARTICIPANT_DATA_SOURCE.REDCAP,
      dataKind: PARTICIPANT_DATA_KIND.UNKNOWN,
    },
    nextEnrollmentDate: syncedConsentDate ?? profile.enrollmentDate,
    action: ADMIN_AUDIT_ACTIONS.PARTICIPANT_UNMARKED_TEST,
  });
}
