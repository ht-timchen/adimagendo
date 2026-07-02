import type { ParticipantDataKind, ParticipantDataSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  canMarkAsPilotParticipant,
  PILOT_PARTICIPANT_PROFILE_WHERE,
} from "./pilot-participant-scope";
import {
  PARTICIPANT_DATA_KIND,
  PARTICIPANT_DATA_SOURCE,
} from "./participant-classification-values";

export const PILOT_PARTICIPANT_PROFILE_UPDATE = {
  dataSource: PILOT_PARTICIPANT_PROFILE_WHERE.dataSource,
  dataKind: PILOT_PARTICIPANT_PROFILE_WHERE.dataKind,
} as const;

export type ParticipantClassificationSnapshot = {
  dataSource: ParticipantDataSource;
  dataKind: ParticipantDataKind;
};

export type MarkPilotParticipantError =
  | "not_found"
  | "not_participant"
  | "not_eligible"
  | "already_pilot";

export type MarkPilotParticipantContext = {
  userId: string;
  /** Admin performing the change (reserved for audit trail). */
  actorUserId: string;
};

export type MarkPilotParticipantResult =
  | {
      ok: true;
      userId: string;
      previous: ParticipantClassificationSnapshot;
      next: ParticipantClassificationSnapshot;
    }
  | { ok: false; error: MarkPilotParticipantError };

export { canMarkAsPilotParticipant };

/**
 * Reserved hook for a future audit trail. Classification changes should be
 * recorded here once persistence is added.
 */
async function recordPilotClassificationChange(event: {
  userId: string;
  actorUserId: string;
  previous: ParticipantClassificationSnapshot;
  next: ParticipantClassificationSnapshot;
}): Promise<void> {
  void event;
  // No-op until audit storage is implemented.
}

export async function markParticipantAsPilot(
  ctx: MarkPilotParticipantContext
): Promise<MarkPilotParticipantResult> {
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: {
      id: true,
      role: true,
      profile: {
        select: {
          id: true,
          dataSource: true,
          dataKind: true,
        },
      },
    },
  });

  if (!user) {
    return { ok: false, error: "not_found" };
  }
  if (user.role !== "PARTICIPANT") {
    return { ok: false, error: "not_participant" };
  }
  if (!user.profile) {
    return { ok: false, error: "not_eligible" };
  }

  const previous: ParticipantClassificationSnapshot = {
    dataSource: user.profile.dataSource,
    dataKind: user.profile.dataKind,
  };

  if (!canMarkAsPilotParticipant(previous)) {
    if (
      previous.dataSource === PARTICIPANT_DATA_SOURCE.REDCAP &&
      previous.dataKind === PARTICIPANT_DATA_KIND.REAL
    ) {
      return { ok: false, error: "already_pilot" };
    }
    return { ok: false, error: "not_eligible" };
  }

  const next: ParticipantClassificationSnapshot = {
    ...PILOT_PARTICIPANT_PROFILE_UPDATE,
  };

  await prisma.participantProfile.update({
    where: { id: user.profile.id },
    data: PILOT_PARTICIPANT_PROFILE_UPDATE,
  });

  await recordPilotClassificationChange({
    userId: ctx.userId,
    actorUserId: ctx.actorUserId,
    previous,
    next,
  });

  return { ok: true, userId: ctx.userId, previous, next };
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
