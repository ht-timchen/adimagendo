import type { ParticipantDataKind, ParticipantDataSource } from "@prisma/client";
import {
  PARTICIPANT_DATA_KIND,
  PARTICIPANT_DATA_SOURCE,
} from "./participant-classification-values";

export type ParticipantClassificationFields = {
  dataSource: ParticipantDataSource;
  dataKind: ParticipantDataKind;
};

/** Manually promoted pilot participants must not be auto-downgraded. */
export function isLockedPilotClassification(
  profile: ParticipantClassificationFields | null | undefined
): boolean {
  if (!profile) return false;
  return (
    profile.dataSource === PARTICIPANT_DATA_SOURCE.REDCAP &&
    profile.dataKind === PARTICIPANT_DATA_KIND.REAL
  );
}

/**
 * Apply automatic classification only when it would not downgrade a locked pilot
 * profile. Explicit admin actions should write REAL directly, not via this helper.
 */
export function resolveAutomaticParticipantClassification(
  existing: ParticipantClassificationFields | null | undefined,
  proposed: ParticipantClassificationFields
): ParticipantClassificationFields {
  if (isLockedPilotClassification(existing)) {
    return {
      dataSource: existing!.dataSource,
      dataKind: existing!.dataKind,
    };
  }
  return proposed;
}
