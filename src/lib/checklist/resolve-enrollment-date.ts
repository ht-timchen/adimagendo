import { prisma } from "@/lib/db";

/**
 * Day 0 for checklist timelines should come from REDCap consent/enrolment when synced.
 * Falls back to app signup time when no REDCap roster row or enrolment date exists.
 */
export async function resolveParticipantEnrollmentDate(
  studyRecordId: string,
  signupFallback: Date = new Date()
): Promise<Date> {
  const sync = await prisma.redcapParticipantSync.findUnique({
    where: { studyRecordId },
    select: { enrollmentDate: true },
  });

  if (sync?.enrollmentDate) {
    return sync.enrollmentDate;
  }

  return signupFallback;
}
