import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Mail, Newspaper, ListChecks } from "lucide-react";

export default async function AdminOverviewPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;

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
    messagesCount,
    newsCount,
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
    prisma.contactMessage.count(),
    prisma.newsPost.count(),
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

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Admin overview
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Study participants and engagement at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Total participants
            </CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalParticipants}</p>
            <p className="text-xs text-slate-500">
              New in last 7d: {newParticipants7d} · 30d: {newParticipants30d}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Active (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeParticipants30d}</p>
            <p className="text-xs text-slate-500">
              Symptom or survey activity
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Checklist completion
            </CardTitle>
            <ListChecks className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{checklistCompletionRate}%</p>
            <p className="text-xs text-slate-500">
              {completedChecklist} of {totalChecklist} items completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Survey responses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{surveyResponsesCount}</p>
            <p className="text-xs text-slate-500">Completed QoL surveys</p>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <Link href="/dashboard/admin/messages">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Contact messages
              </CardTitle>
              <Mail className="h-4 w-4 text-violet-600" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{messagesCount}</p>
              <p className="text-xs text-slate-500">View inbox</p>
            </CardContent>
          </Link>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <Link href="/dashboard/admin/news">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                News posts
              </CardTitle>
              <Newspaper className="h-4 w-4 text-violet-600" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{newsCount}</p>
              <p className="text-xs text-slate-500">Manage news</p>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}
