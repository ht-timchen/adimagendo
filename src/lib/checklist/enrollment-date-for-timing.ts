import type { ParticipantDataKind, ParticipantDataSource } from "@prisma/client";
import {
  PARTICIPANT_DATA_KIND,
  PARTICIPANT_DATA_SOURCE,
} from "@/lib/participant/participant-classification-values";
import { prisma } from "@/lib/db";
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

/** Synced REDCap consent date to look up, or null when the profile date is used directly. */
export function consentLookupRecordId(
  profile: ParticipantProfileTimingFields
): string | null {
  if (isTestParticipantForTiming(profile)) return null;
  if (
    profile.dataSource === PARTICIPANT_DATA_SOURCE.REDCAP &&
    profile.studyRecordId
  ) {
    return profile.studyRecordId;
  }
  return null;
}

/**
 * Pure resolution given the synced consent date (only consulted when
 * consentLookupRecordId(profile) is non-null).
 */
export function resolveEnrollmentDateFromConsent(
  profile: ParticipantProfileTimingFields,
  consentDate: Date | null
): EnrollmentDateForTiming {
  if (consentLookupRecordId(profile) == null) {
    return { enrollmentDate: profile.enrollmentDate, missing: false };
  }
  if (consentDate) {
    return { enrollmentDate: consentDate, missing: false };
  }
  if (isRealRedcapParticipant(profile)) {
    return { enrollmentDate: null, missing: true };
  }
  return { enrollmentDate: profile.enrollmentDate, missing: false };
}

type ConsentDateLoader = (studyRecordId: string) => Promise<Date | null>;
type ConsentDateBatchLoader = (
  studyRecordIds: string[]
) => Promise<Map<string, Date | null>>;

/**
 * Enrollment date used for checklist due/unlock calculations.
 * Real REDCap pilots require a synced consent date; test accounts use profile dates.
 */
export async function resolveEnrollmentDateForTiming(
  profile: ParticipantProfileTimingFields,
  deps: { getConsentDate?: ConsentDateLoader } = {}
): Promise<EnrollmentDateForTiming> {
  const recordId = consentLookupRecordId(profile);
  const consentDate = recordId
    ? await (deps.getConsentDate ?? getRedcapConsentEnrollmentDate)(recordId)
    : null;
  return resolveEnrollmentDateFromConsent(profile, consentDate);
}

async function loadRedcapConsentDates(
  studyRecordIds: string[]
): Promise<Map<string, Date | null>> {
  if (studyRecordIds.length === 0) return new Map();
  const rows = await prisma.redcapParticipantSync.findMany({
    where: { studyRecordId: { in: studyRecordIds } },
    select: { studyRecordId: true, enrollmentDate: true },
  });
  return new Map(rows.map((r) => [r.studyRecordId, r.enrollmentDate]));
}

/**
 * Batched form of resolveEnrollmentDateForTiming for admin lists: one sync query,
 * same Day 0 as the participant view. Keys are caller-supplied (e.g. userId).
 */
export async function resolveEnrollmentDatesForTiming<K>(
  entries: { key: K; profile: ParticipantProfileTimingFields }[],
  deps: { getConsentDates?: ConsentDateBatchLoader } = {}
): Promise<Map<K, EnrollmentDateForTiming>> {
  const recordIds = [
    ...new Set(
      entries
        .map((e) => consentLookupRecordId(e.profile))
        .filter((id): id is string => id != null)
    ),
  ];
  const consentDates = await (deps.getConsentDates ?? loadRedcapConsentDates)(
    recordIds
  );
  return new Map(
    entries.map((e) => {
      const recordId = consentLookupRecordId(e.profile);
      const consentDate = recordId ? consentDates.get(recordId) ?? null : null;
      return [e.key, resolveEnrollmentDateFromConsent(e.profile, consentDate)];
    })
  );
}
