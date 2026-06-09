import { prisma } from "@/lib/db";

/**
 * REDCap consent / signature date from the synced roster (source of truth for real participants).
 */
export async function getRedcapConsentEnrollmentDate(
  studyRecordId: string
): Promise<Date | null> {
  const sync = await prisma.redcapParticipantSync.findUnique({
    where: { studyRecordId },
    select: { enrollmentDate: true },
  });

  return sync?.enrollmentDate ?? null;
}

/**
 * Resolve enrollment date for REDCap magic-link enrolment.
 * Does not fall back to signup time — callers must handle a missing consent date.
 */
export async function resolveParticipantEnrollmentDate(
  studyRecordId: string
): Promise<Date | null> {
  return getRedcapConsentEnrollmentDate(studyRecordId);
}
