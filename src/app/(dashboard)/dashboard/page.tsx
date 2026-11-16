import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  participantDashboardLinkCardClassName,
  participantDashboardSurfaceClassName,
  participantFocusRingClassName,
} from "@/lib/participant-dashboard-ui";
import {
  Activity,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  ListChecks,
  NotebookPen,
  PieChart,
} from "lucide-react";
import { ParticipantIconBadge } from "@/components/participant/participant-icon-badge";
import { ProfileHeartIcon } from "@/components/participant/profile-heart-icon";
import { ParticipantSearch } from "@/components/participant-search";
import {
  PARTICIPANT_APPOINTMENTS_PATH,
  PARTICIPANT_CHECKLIST_PATH,
  PARTICIPANT_DIARY_PATH,
  PARTICIPANT_PROFILE_PATH,
  PARTICIPANT_SYMPTOMS_PATH,
} from "@/lib/participant-routes";
import { MedicalAppointmentsReminderBanner } from "@/components/medical-appointments-reminder-banner";
import { SchoolAttendanceReminderBanner } from "@/components/school-attendance-reminder-banner";
import { computeAdminChecklistProgress } from "@/lib/admin/checklist-progress";
import { getMedicalAppointmentsBannerState } from "@/lib/medical-appointments-reminder/cycle";
import { getSchoolAttendanceBannerState } from "@/lib/school-attendance-reminder/cycle";
import { getValidChecklistTemplateIds } from "@/lib/valid-checklist-items";
import { isAdminDashboardRole } from "@/lib/admin-rbac";
import { requireActiveParticipantPage } from "@/lib/participant-page-access";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (isAdminDashboardRole(session)) {
    redirect("/dashboard/admin");
  }

  await requireActiveParticipantPage(session);

  const userId = session.user.id;
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
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
    schoolAttendanceBanner,
    medicalAppointmentsBanner,
  ] = await Promise.all([
    prisma.participantProfile.findUnique({
      where: { userId },
    }),
    prisma.participantChecklistItem.findMany({
      where: { userId, ...checklistScope },
      select: {
        status: true,
        template: { select: { key: true, title: true } },
      },
    }),
    prisma.appointment.findMany({
      where: {
        userId,
        startAt: { gte: now },
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
    getSchoolAttendanceBannerState(userId),
    getMedicalAppointmentsBannerState(userId),
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
    <div className="light [color-scheme:light] mx-auto max-w-4xl space-y-4 text-participant-ink">
      {/* Positioned against the full-width <main>, not this column; the wrapper clips the right-edge overhang. */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/background-participant-pink.png"
          alt=""
          className="absolute right-[-3%] top-1.5 w-[88%] max-w-[720px] opacity-20"
        />
      </div>
      <div className="pt-2">
        <h1 className="break-words text-participant-heading">
          <span className="block text-[1.75rem] leading-tight">Welcome back,</span>
          <span className="block text-4xl font-semibold leading-tight">{displayName}</span>
        </h1>
        <span className="mt-3 block h-px w-12 bg-participant-accent/70" aria-hidden="true" />
        <p className="mt-3 text-participant-ink">
          {profile?.studyPhase
            ? `Study phase: ${profile.studyPhase}`
            : "Your participant dashboard"}
        </p>
      </div>

      {schoolAttendanceBanner ? (
        <SchoolAttendanceReminderBanner {...schoolAttendanceBanner} />
      ) : null}

      {medicalAppointmentsBanner ? (
        <MedicalAppointmentsReminderBanner {...medicalAppointmentsBanner} />
      ) : null}

      {staleUnconfirmedBookings.length > 0 ? (
        <div
          className="flex gap-3 rounded-2xl border border-l-4 border-participant-primary/40 border-l-participant-primary bg-participant-card p-4 text-sm text-participant-ink shadow-(--participant-shadow) backdrop-blur-md"
          role="status"
        >
          <ParticipantIconBadge icon={CalendarCheck} className="text-participant-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-participant-heading">Please confirm your appointment</p>
            <p className="mt-1">
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
              href={PARTICIPANT_CHECKLIST_PATH}
              className={cn(
                "mt-3 inline-flex h-9 items-center gap-1 rounded-lg bg-participant-button px-3 font-medium text-white transition-colors hover:bg-participant-button-hover active:bg-participant-button-active",
                participantFocusRingClassName
              )}
            >
              Go to checklist
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : null}

      <Link
        href={PARTICIPANT_CHECKLIST_PATH}
        className={cn("block p-4", participantDashboardLinkCardClassName, participantFocusRingClassName)}
      >
        <div className="flex items-start gap-3">
          <ParticipantIconBadge icon={PieChart} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg text-participant-heading">Your progress</h2>
              <ChevronRight className="h-4 w-4 shrink-0 text-participant-muted" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-2 text-sm">
              <span className="text-participant-muted">Study steps completed</span>
              <span className="text-base font-medium text-participant-heading">
                {stepsCompleted} of {stepsTotal}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-participant-tint" aria-hidden="true">
          <div
            className="h-full rounded-full bg-participant-primary transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href={PARTICIPANT_CHECKLIST_PATH}
          className={cn(
            "flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4",
            participantDashboardLinkCardClassName,
            participantFocusRingClassName
          )}
        >
          <div className="flex items-start justify-between sm:contents">
            <ParticipantIconBadge icon={ListChecks} />
            <ChevronRight className="h-4 w-4 text-participant-muted sm:order-last" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg text-participant-heading">Checklist</h2>
            <p className="text-sm text-participant-muted">
              {stepsRemaining > 0
                ? studyProgress.currentStepName
                  ? `Next: ${studyProgress.currentStepName}`
                  : `${stepsRemaining} step${stepsRemaining === 1 ? "" : "s"} remaining`
                : "All study steps complete."}
            </p>
          </div>
        </Link>

        <Link
          href={PARTICIPANT_APPOINTMENTS_PATH}
          className={cn(
            "flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4",
            participantDashboardLinkCardClassName,
            participantFocusRingClassName
          )}
        >
          <div className="flex items-start justify-between sm:contents">
            <ParticipantIconBadge icon={CalendarDays} />
            <ChevronRight className="h-4 w-4 text-participant-muted sm:order-last" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg text-participant-heading">Appointments</h2>
            <p className="text-sm text-participant-muted">
              {upcomingAppointments.length > 0
                ? `${upcomingAppointments.length} upcoming`
                : "No bookings yet"}
            </p>
          </div>
        </Link>
      </div>

      <div className={cn("relative z-20 flex items-stretch rounded-2xl", participantDashboardSurfaceClassName)}>
        <Link
          href={PARTICIPANT_CHECKLIST_PATH}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-participant-ink transition-colors hover:bg-participant-surface sm:gap-3 sm:px-4",
            participantFocusRingClassName
          )}
        >
          <ClipboardList className="h-5 w-5 shrink-0 text-participant-primary-active" strokeWidth={1.5} aria-hidden="true" />
          <span className="flex-1">View checklist</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-participant-muted" strokeWidth={1.5} aria-hidden="true" />
        </Link>
        <span className="my-2.5 w-px shrink-0 bg-participant-primary/15" aria-hidden="true" />
        <ParticipantSearch
          checklistItems={checklistItems.map((item) => ({
            key: item.template.key,
            title: item.template.title,
          }))}
        />
      </div>

      <nav aria-label="Quick links" className="grid grid-cols-3 gap-3 pt-1">
        {[
          { href: PARTICIPANT_PROFILE_PATH, label: "Profile", icon: ProfileHeartIcon },
          { href: PARTICIPANT_DIARY_PATH, label: "Diary", icon: NotebookPen },
          { href: PARTICIPANT_SYMPTOMS_PATH, label: "Symptoms", icon: Activity },
        ].map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className={cn(
              "group flex flex-col items-center gap-2 rounded-2xl py-2 text-sm font-medium text-participant-ink",
              participantFocusRingClassName
            )}
          >
            <ParticipantIconBadge
              icon={tile.icon}
              size="lg"
              className="bg-participant-card shadow-(--participant-shadow) ring-participant-primary/15 transition-colors group-hover:bg-participant-surface"
            />
            <span>{tile.label}</span>
            <span className="h-0.5 w-6 rounded-full bg-participant-accent/50" aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
