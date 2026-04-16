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
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="mb-3 inline-flex items-center text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Appointments
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
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
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-600 dark:text-slate-400">
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
                  className={
                    cancelled ? "opacity-70 ring-1 ring-slate-200 dark:ring-slate-800" : ""
                  }
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold">
                        {a.title}
                      </CardTitle>
                      <p className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
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
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            Location:{" "}
                          </span>
                          {displayLocation}
                        </p>
                      ) : null}
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">
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
                    <CardContent className="pt-0 text-sm text-slate-600 dark:text-slate-400">
                      {a.description}
                    </CardContent>
                  ) : null}
                  {a.externalUrl ? (
                    <CardContent className="pt-0">
                      <a
                        href={a.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
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
