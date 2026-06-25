import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddToCalendarButton } from "@/components/add-to-calendar-button";
import {
  AppointmentManageCardActions,
  type SerializableAppointment,
} from "@/components/appointment-manage-card-actions";
import {
  participantDashboardCardClassName,
  participantDashboardHeadingClassName,
  participantDashboardMutedClassName,
  participantDashboardPageClassName,
  participantDashboardPageTitleClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";
import { CalendarClock, ChevronLeft } from "lucide-react";

export default async function AppointmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const raw = await prisma.appointment.findMany({
    where: { userId: session.user.id },
  });

  const appointments = [...raw].sort((a, b) => {
    const ac = a.status === "CANCELLED" ? 1 : 0;
    const bc = b.status === "CANCELLED" ? 1 : 0;
    if (ac !== bc) return ac - bc;
    return a.startAt.getTime() - b.startAt.getTime();
  });

  return (
    <div className={participantDashboardPageClassName}>
      <div>
        <Link
          href="/dashboard"
          className="mb-3 inline-flex items-center text-sm font-medium text-[#2F8F7A] hover:text-[#277866]"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
        <h1 className={participantDashboardPageTitleClassName}>
          Appointments
        </h1>
        <p className="text-[#17483F]">
          Confirmed visits can be added to Apple Calendar, Google Calendar, or
          Outlook using <span className="font-medium">Add to Calendar</span>.
          If your browser does not download the calendar file (common on
          Safari), use <span className="font-medium">Edit appointment</span>{" "}
          or <span className="font-medium">Cancel appointment</span> below to
          change or remove a visit. Cancelling a checklist-linked visit sends
          you back to the checklist to pick a new time.
        </p>
      </div>

      {appointments.length === 0 ? (
        <Card className={participantDashboardCardClassName}>
          <CardContent className={cn("py-10 text-center text-sm", participantDashboardMutedClassName)}>
            You have no appointments yet. When your study team schedules a visit,
            it will appear here.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {appointments.map((a) => {
            const showIcs = a.status === "CONFIRMED";
            const displayStart = a.scheduledStartAt ?? a.startAt;
            const displayLocation = a.scheduledLocation ?? a.location;
            const cancelled = a.status === "CANCELLED";

            const serializable: SerializableAppointment = {
              id: a.id,
              title: a.title,
              status: a.status,
              startAt: a.startAt.toISOString(),
              scheduledStartAt: a.scheduledStartAt?.toISOString() ?? null,
              scheduledLocation: a.scheduledLocation,
              location: a.location,
              description: a.description,
              externalUrl: a.externalUrl,
              participantChecklistItemId: a.participantChecklistItemId,
            };

            return (
              <li key={a.id}>
                <Card
                  className={cn(
                    participantDashboardCardClassName,
                    cancelled && "opacity-70 ring-1 ring-[#2F8F7A]/15"
                  )}
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                    <div className="space-y-1">
                      <CardTitle className={cn("text-base font-semibold", participantDashboardHeadingClassName)}>
                        {a.title}
                      </CardTitle>
                      <p className={cn("flex items-center gap-1.5 text-sm", participantDashboardMutedClassName)}>
                        <CalendarClock className="h-4 w-4 shrink-0" />
                        {displayStart.toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                        {a.endAt
                          ? ` – ${a.endAt.toLocaleTimeString(undefined, {
                              timeStyle: "short",
                            })}`
                          : null}
                      </p>
                      {displayLocation ? (
                        <p className={cn("text-sm", participantDashboardMutedClassName)}>
                          <span className={cn("font-medium", participantDashboardHeadingClassName)}>
                            Location:{" "}
                          </span>
                          {displayLocation}
                        </p>
                      ) : null}
                      <p className={cn("text-xs uppercase tracking-wide", participantDashboardMutedClassName)}>
                        Status: {a.status.toLowerCase()}
                      </p>
                    </div>
                    {showIcs ? (
                      <AddToCalendarButton
                        input={{
                          appointmentId: a.id,
                          startAt: displayStart,
                          endAt: a.endAt,
                          location: displayLocation,
                          appointmentTitle: a.title,
                          description: a.description,
                          externalUrl: a.externalUrl,
                        }}
                        className="shrink-0"
                      />
                    ) : null}
                  </CardHeader>
                  {a.description ? (
                    <CardContent className={cn("pt-0 text-sm", participantDashboardMutedClassName)}>
                      {a.description}
                    </CardContent>
                  ) : null}
                  {a.externalUrl ? (
                    <CardContent className="pt-0">
                      <a
                        href={a.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-[#2F8F7A] hover:text-[#277866] hover:underline"
                      >
                        Open booking link
                      </a>
                    </CardContent>
                  ) : null}
                  {!cancelled ? (
                    <CardContent className="pt-0">
                      <AppointmentManageCardActions appointment={serializable} />
                    </CardContent>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
