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
 * REDCap profiles an admin has classified (REAL pilot or TEST) must not be
 * changed by automatic flows. Automatic rules only produce REDCAP + TEST for
 * "TEST…" record ids, so keeping every REDCAP + TEST loses nothing.
 */
export function isProtectedFromAutomaticClassification(
  profile: ParticipantClassificationFields | null | undefined
): boolean {
  if (!profile) return false;
  return (
    isLockedPilotClassification(profile) ||
    (profile.dataSource === PARTICIPANT_DATA_SOURCE.REDCAP &&
      profile.dataKind === PARTICIPANT_DATA_KIND.TEST)
  );
}

/**
 * Apply automatic classification only when it would not overwrite a protected
 * profile. Explicit admin actions write directly, not via this helper.
 */
export function resolveAutomaticParticipantClassification(
  existing: ParticipantClassificationFields | null | undefined,
  proposed: ParticipantClassificationFields
): ParticipantClassificationFields {
  if (isProtectedFromAutomaticClassification(existing)) {
    return {
      dataSource: existing!.dataSource,
      dataKind: existing!.dataKind,
    };
  }
  return proposed;
}
