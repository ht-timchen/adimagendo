import { prisma } from "@/lib/db";

export async function lastActiveTimestamp(userId: string): Promise<Date | null> {
  const [sym, survey, appt] = await Promise.all([
    prisma.symptomEntry.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
    prisma.surveyResponse.findFirst({
      where: { userId, completed: true },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    prisma.appointment.findFirst({
      where: { userId },
      orderBy: { startAt: "desc" },
      select: { startAt: true },
    }),
  ]);
  const candidates = [sym?.date, survey?.updatedAt, appt?.startAt].filter(
    (d): d is Date => d instanceof Date
  );
  if (candidates.length === 0) return null;
  return new Date(Math.max(...candidates.map((d) => d.getTime())));
}

export function displayStudyRecordId(
  profile: { studyRecordId?: string | null } | null | undefined,
  userId: string
): string {
  const id = profile?.studyRecordId?.trim();
  if (id) return id;
  return userId.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase() || userId.slice(0, 8);
}

/** Engagement tiers for admin overview (days since last symptom/survey/appointment activity). */
export function participantEngagementStatus(
  active: boolean,
  lastActive: Date | null,
  now: Date
): "active" | "inactive" | "at_risk" | "withdrawn" {
  if (!active) return "withdrawn";
  if (!lastActive) return "at_risk";
  const days = (now.getTime() - lastActive.getTime()) / 86400000;
  if (days < 7) return "active";
  if (days <= 30) return "inactive";
  return "at_risk";
}
