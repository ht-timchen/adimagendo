import type { ParticipantDataKind, ParticipantDataSource } from "@prisma/client";
import {
  PARTICIPANT_DATA_KIND,
  PARTICIPANT_DATA_SOURCE,
} from "@/lib/participant/participant-classification-values";
import { getRedcapConsentEnrollmentDate } from "./resolve-enrollment-date";

export const MISSING_ENROLLMENT_DATE_MESSAGE =
  "Enrollment date is missing. Checklist timing cannot be calculated.";

export type ParticipantProfileTimingFields = {
  dataSource: ParticipantDataSource;
  dataKind: ParticipantDataKind;
  studyRecordId: string | null;
  enrollmentDate: Date;
};

export function isLocalTestParticipant(
  profile: Pick<ParticipantProfileTimingFields, "dataSource" | "dataKind">
): boolean {
  return (
    profile.dataSource === PARTICIPANT_DATA_SOURCE.LOCAL &&
    profile.dataKind === PARTICIPANT_DATA_KIND.TEST
  );
}

/** Local or REDCap-linked test accounts may use profile enrollment dates. */
export function isTestParticipantForTiming(
  profile: Pick<ParticipantProfileTimingFields, "dataSource" | "dataKind">
): boolean {
  return (
    isLocalTestParticipant(profile) ||
    (profile.dataSource === PARTICIPANT_DATA_SOURCE.REDCAP &&
      profile.dataKind === PARTICIPANT_DATA_KIND.TEST)
  );
}

export function isRealRedcapParticipant(
  profile: Pick<ParticipantProfileTimingFields, "dataSource" | "dataKind">
): boolean {
  return (
    profile.dataSource === PARTICIPANT_DATA_SOURCE.REDCAP &&
    profile.dataKind === PARTICIPANT_DATA_KIND.REAL
  );
}

export type EnrollmentDateForTiming = {
  enrollmentDate: Date | null;
  missing: boolean;
};

/**
 * Enrollment date used for checklist due/unlock calculations.
 * Real REDCap pilots require a synced consent date; test accounts use profile dates.
 */
export async function resolveEnrollmentDateForTiming(
  profile: ParticipantProfileTimingFields
): Promise<EnrollmentDateForTiming> {
  if (isTestParticipantForTiming(profile)) {
    return { enrollmentDate: profile.enrollmentDate, missing: false };
  }

  if (
    profile.dataSource === PARTICIPANT_DATA_SOURCE.REDCAP &&
    profile.studyRecordId
  ) {
    const consentDate = await getRedcapConsentEnrollmentDate(
      profile.studyRecordId
    );

    if (isRealRedcapParticipant(profile)) {
      if (consentDate) {
        return { enrollmentDate: consentDate, missing: false };
      }
      return { enrollmentDate: null, missing: true };
    }

    if (consentDate) {
      return { enrollmentDate: consentDate, missing: false };
    }
    return { enrollmentDate: profile.enrollmentDate, missing: false };
  }

  return { enrollmentDate: profile.enrollmentDate, missing: false };
}
