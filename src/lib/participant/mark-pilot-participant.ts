import type { Session } from "next-auth";
import { prisma } from "@/lib/db";
import { ADMIN_AUDIT_ACTIONS, createAdminAuditEventInTx } from "@/lib/admin-audit";
import {
  canMarkAsPilotParticipant,
  PILOT_PARTICIPANT_PROFILE_WHERE,
} from "./pilot-participant-scope";
import {
  PARTICIPANT_DATA_KIND,
  PARTICIPANT_DATA_SOURCE,
} from "./participant-classification-values";
import type { ClassificationChangeReasonInput } from "./classification-change-reason";
import {
  CLASSIFICATION_CONFLICT_MESSAGE,
  classificationAuditMetadata,
  classificationChangeFailure,
  ClassificationConflictError,
  loadParticipantForClassificationChange,
  type ClassificationChangeFailure,
  type ParticipantClassificationSnapshot,
} from "./classification-change-common";

export type { ParticipantClassificationSnapshot };

export const PILOT_PARTICIPANT_PROFILE_UPDATE = {
  dataSource: PILOT_PARTICIPANT_PROFILE_WHERE.dataSource,
  dataKind: PILOT_PARTICIPANT_PROFILE_WHERE.dataKind,
} as const;

export type MarkPilotParticipantError =
  | "not_found"
  | "not_participant"
  | "not_eligible"
  | "already_pilot";

export type MarkPilotParticipantContext = {
  userId: string;
  session: Session;
  reason: ClassificationChangeReasonInput;
};

export type MarkPilotParticipantResult =
  | {
      ok: true;
      userId: string;
      previous: ParticipantClassificationSnapshot;
      next: ParticipantClassificationSnapshot;
    }
  | ClassificationChangeFailure;

export { canMarkAsPilotParticipant };

export async function markParticipantAsPilot(
  ctx: MarkPilotParticipantContext
): Promise<MarkPilotParticipantResult> {
  const loaded = await loadParticipantForClassificationChange({
    ...ctx,
    action: "mark_pilot",
    permission: "participant:mark_pilot",
  });
  if (!loaded.ok) {
    if (
      loaded.error === "not_found" ||
      loaded.error === "not_participant" ||
      loaded.error === "not_eligible"
    ) {
      return classificationChangeFailure(
        loaded.error,
        markPilotParticipantErrorMessage(loaded.error)
      );
    }
    return loaded;
  }

  const { profile } = loaded;
  const previous: ParticipantClassificationSnapshot = {
    dataSource: profile.dataSource,
    dataKind: profile.dataKind,
  };

  if (!canMarkAsPilotParticipant(previous)) {
    const error: MarkPilotParticipantError =
      previous.dataSource === PARTICIPANT_DATA_SOURCE.REDCAP &&
      previous.dataKind === PARTICIPANT_DATA_KIND.REAL
        ? "already_pilot"
        : "not_eligible";
    return classificationChangeFailure(error, markPilotParticipantErrorMessage(error));
  }

  const next: ParticipantClassificationSnapshot = {
    ...PILOT_PARTICIPANT_PROFILE_UPDATE,
  };

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.participantProfile.updateMany({
        where: {
          id: profile.id,
          dataSource: previous.dataSource,
          dataKind: previous.dataKind,
        },
        data: PILOT_PARTICIPANT_PROFILE_UPDATE,
      });
      if (updated.count !== 1) throw new ClassificationConflictError();

      await createAdminAuditEventInTx(tx, {
        session: ctx.session,
        action: ADMIN_AUDIT_ACTIONS.PARTICIPANT_MARKED_PILOT,
        targetType: "participant",
        targetId: loaded.userId,
        targetName: profile.studyRecordId,
        metadata: classificationAuditMetadata({
          studyRecordId: profile.studyRecordId,
          field: "dataKind",
          from: previous.dataKind,
          to: next.dataKind,
          reason: loaded.reason,
        }),
      });
    });
  } catch (e) {
    if (e instanceof ClassificationConflictError) {
      return classificationChangeFailure("conflict", CLASSIFICATION_CONFLICT_MESSAGE);
    }
    throw e;
  }

  return { ok: true, userId: loaded.userId, previous, next };
}

export function markPilotParticipantErrorMessage(
  error: MarkPilotParticipantError
): string {
  switch (error) {
    case "not_found":
      return "Participant not found.";
    case "not_participant":
      return "Only participant accounts can be marked as pilot.";
    case "already_pilot":
      return "This participant is already classified as a pilot participant.";
    case "not_eligible":
      return "Only REDCap participants with Unknown classification can be marked as pilot.";
  }
}
