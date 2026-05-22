import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ListChecks,
  Calendar,
  FileText,
  ChevronRight,
  CalendarClock,
} from "lucide-react";
import { PushNotificationOptIn } from "@/components/push-notification-opt-in";
import { computeAdminChecklistProgress } from "@/lib/admin/checklist-progress";
import { getValidChecklistTemplateIds } from "@/lib/valid-checklist-items";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = session.user.role;
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    redirect("/dashboard/admin");
  }

  const userId = session.user.id;
  const staleCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const validTemplateIds = await getValidChecklistTemplateIds();
  const checklistScope =
    validTemplateIds.length > 0
      ? { templateId: { in: validTemplateIds } }
      : { templateId: { in: [] as string[] } };

  const [
    profile,
    checklistItems,
    upcomingAppointments,
    staleUnconfirmedBookings,
    recentSymptoms,
  ] = await Promise.all([
    prisma.participantProfile.findUnique({
      where: { userId },
    }),
    prisma.participantChecklistItem.findMany({
      where: { userId, ...checklistScope },
      select: {
        status: true,
        template: { select: { key: true } },
      },
    }),
    prisma.appointment.findMany({
      where: {
        userId,
        startAt: { gte: new Date() },
        status: { not: "CANCELLED" },
      },
      orderBy: { startAt: "asc" },
      take: 3,
    }),
    prisma.participantChecklistItem.findMany({
      where: {
        userId,
        bookingProgress: "BOOKED_EXTERNALLY",
        bookedExternallyAt: { not: null, lt: staleCutoff },
        template: { externalUrl: { not: null } },
      },
      include: { template: { select: { title: true } } },
    }),
    prisma.symptomEntry.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 5,
    }),
  ]);

  const studyProgress = computeAdminChecklistProgress(
    checklistItems.map((item) => ({
      templateKey: item.template.key,
      status: item.status,
    }))
  );
  const stepsCompleted = studyProgress.completed;
  const stepsTotal = studyProgress.total;
  const stepsRemaining = stepsTotal - stepsCompleted;
  const progressPercent = Math.round((stepsCompleted / stepsTotal) * 100);

  const displayName = session.user.name ?? session.user.email ?? "Participant";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Welcome back, {displayName}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {profile?.studyPhase
            ? `Study phase: ${profile.studyPhase}`
            : "Your participant dashboard"}
        </p>
      </div>

      {staleUnconfirmedBookings.length > 0 ? (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-50"
          role="status"
        >
          <p className="font-semibold">Please confirm your appointment</p>
          <p className="mt-1 text-amber-900/95 dark:text-amber-100/90">
            It has been more than 48 hours since you booked using an external
            site. Return to your checklist to enter the date and time you chose
            so reminders stay accurate.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {staleUnconfirmedBookings.map((row) => (
              <li key={row.id}>{row.template.title}</li>
            ))}
          </ul>
          <Link
            href="/dashboard/checklist"
            className="mt-3 inline-flex font-medium text-amber-950 underline-offset-2 hover:underline dark:text-amber-100"
          >
            Go to checklist
          </Link>
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">
              Study steps completed
            </span>
            <span className="font-medium">
              {stepsCompleted} of {stepsTotal}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-violet-600 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <PushNotificationOptIn />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Checklist</CardTitle>
            <ListChecks className="h-5 w-5 text-violet-600" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {stepsRemaining > 0
                ? studyProgress.currentStepName
                  ? `Next: ${studyProgress.currentStepName}`
                  : `${stepsRemaining} step${stepsRemaining === 1 ? "" : "s"} remaining`
                : "All study steps complete."}
            </p>
            <Link
              href="/dashboard/checklist"
              className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-slate-100 px-3 text-sm font-medium hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              View checklist <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Appointments</CardTitle>
            <CalendarClock className="h-5 w-5 text-violet-600" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {upcomingAppointments.length > 0
                ? `${upcomingAppointments.length} upcoming`
                : "No upcoming appointments"}
            </p>
            <Link
              href="/dashboard/appointments"
              className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-slate-100 px-3 text-sm font-medium hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              View appointments <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <Link
            href="/dashboard/symptoms"
            className="inline-flex h-10 items-center justify-start rounded-lg border border-slate-200 bg-white px-4 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <Calendar className="mr-2 h-4 w-4" />
            Log symptoms
          </Link>
          <Link
            href="/dashboard/surveys"
            className="inline-flex h-10 items-center justify-start rounded-lg border border-slate-200 bg-white px-4 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <FileText className="mr-2 h-4 w-4" />
            Complete survey
          </Link>
        </CardContent>
      </Card>

      {recentSymptoms.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent symptom entries</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {recentSymptoms.map((s) => (
                <li
                  key={s.id}
                  className="flex justify-between text-slate-600 dark:text-slate-400"
                >
                  <span>{s.date.toLocaleDateString()}</span>
                  <span>
                    Pain: {s.painLevel}/10
                    {Array.isArray(s.symptoms) &&
                      s.symptoms.length > 0 &&
                      ` · ${(s.symptoms as string[]).join(", ")}`}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
