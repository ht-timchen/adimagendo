import type { ParticipantDataKind, ParticipantDataSource } from "@prisma/client";
import {
  PARTICIPANT_DATA_KIND,
  PARTICIPANT_DATA_SOURCE,
} from "./participant-classification-values";
import { isDummyRedcapStudyRecordId } from "./participant-data-classification";

type ClassificationProfile = {
  dataSource: ParticipantDataSource;
  dataKind: ParticipantDataKind;
  studyRecordId: string | null;
};

/** Mirrors markParticipantAsTest: REDCAP + UNKNOWN only. */
export function canMarkAsTestParticipant(profile: ClassificationProfile): boolean {
  return (
    profile.dataSource === PARTICIPANT_DATA_SOURCE.REDCAP &&
    profile.dataKind === PARTICIPANT_DATA_KIND.UNKNOWN
  );
}

/** Mirrors unmarkTestParticipant: REDCAP + TEST, except "TEST…" record ids. */
export function canUnmarkTestParticipant(profile: ClassificationProfile): boolean {
  return (
    profile.dataSource === PARTICIPANT_DATA_SOURCE.REDCAP &&
    profile.dataKind === PARTICIPANT_DATA_KIND.TEST &&
    !isDummyRedcapStudyRecordId(profile.studyRecordId)
  );
}

/** Why no classification button is offered, for the admin card. */
export function classificationLockedReason(profile: ClassificationProfile): string | null {
  if (profile.dataSource === PARTICIPANT_DATA_SOURCE.LOCAL) {
    return "Local accounts are always test accounts.";
  }
  if (profile.dataKind === PARTICIPANT_DATA_KIND.REAL) {
    return "Pilot participants cannot be reclassified in the app.";
  }
  if (
    profile.dataKind === PARTICIPANT_DATA_KIND.TEST &&
    isDummyRedcapStudyRecordId(profile.studyRecordId)
  ) {
    return "Records whose ID starts with TEST are always test records.";
  }
  return null;
}
