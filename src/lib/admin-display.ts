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

export type ParticipantStudyStatus = "active" | "withdrawn";

/** Participant status: enrolled vs withdrawn. */
export function participantEngagementStatus(active: boolean): ParticipantStudyStatus {
  if (!active) return "withdrawn";
  return "active";
}

export function participantStatusDisplay(status: ParticipantStudyStatus): {
  label: string;
  dot: string;
} {
  switch (status) {
    case "active":
      return { label: "Active", dot: "bg-emerald-500" };
    case "withdrawn":
      return { label: "Withdrawn", dot: "bg-slate-700" };
    default:
      return { label: status, dot: "bg-slate-400" };
  }
}
