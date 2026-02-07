import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalParticipants,
    newParticipants7d,
    newParticipants30d,
    checklistAgg,
    surveyResponsesCount,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "PARTICIPANT" } }),
    prisma.user.count({
      where: { role: "PARTICIPANT", createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.user.count({
      where: { role: "PARTICIPANT", createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.participantChecklistItem.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.surveyResponse.count({ where: { completed: true } }),
  ]);

  const totalChecklist = checklistAgg.reduce((s, c) => s + c._count, 0);
  const completedChecklist =
    checklistAgg.find((c) => c.status === "COMPLETED")?._count ?? 0;
  const checklistCompletionRate =
    totalChecklist > 0
      ? Math.round((completedChecklist / totalChecklist) * 100)
      : 0;

  const activeParticipants30d = await prisma.user.count({
    where: {
      role: "PARTICIPANT",
      OR: [
        { symptoms: { some: { date: { gte: thirtyDaysAgo } } } },
        { surveyResponses: { some: { updatedAt: { gte: thirtyDaysAgo } } } },
      ],
    },
  });

  return NextResponse.json({
    totalParticipants,
    newParticipants7d,
    newParticipants30d,
    activeParticipants30d,
    checklistCompletionRate,
    surveyResponsesCount,
  });
}
