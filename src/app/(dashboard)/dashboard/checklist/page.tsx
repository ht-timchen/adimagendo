import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { REDCAP_PRE_SCREENING_SURVEY_URL } from "@/lib/redcap";
import {
  evaluateStepAvailability,
  loadWorkflowEvaluationContext,
} from "@/lib/workflow";
import {
  BOOK_APPOINTMENT_ROWS,
  BOOK_APPOINTMENTS_GROUP_KEY,
  isBookAppointmentsGroupKey,
} from "@/lib/checklist-booking-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkCompleteButton } from "@/components/checklist-mark-complete";
import { ChecklistSurveySheet } from "@/components/checklist-survey-sheet";
import { ChecklistExternalBookingFlow } from "@/components/checklist-external-booking-flow";
import { ChecklistLockReasons } from "@/components/checklist-lock-reasons";
import { ChecklistBookingGroupCard } from "@/components/checklist-booking-group-card";
import { Check } from "lucide-react";

const BOOK_GROUP_HEADER = {
  title: "Book appointments",
  description:
    "Book your ultrasound, MRI, and blood test appointments. All three must be booked before you continue.",
};

export default async function ChecklistPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const profile = await prisma.participantProfile.findUnique({
    where: { userId: session.user.id },
  });
  const enrollmentDate = profile?.enrollmentDate ?? new Date();

  const [templates, userItems] = await Promise.all([
    prisma.checklistTemplate.findMany({
      orderBy: { sortOrder: "asc" },
    }),
    prisma.participantChecklistItem.findMany({
      where: { userId: session.user.id },
      include: { template: true },
    }),
  ]);

  let workflowContext: Awaited<
    ReturnType<typeof loadWorkflowEvaluationContext>
  > = null;
  try {
    workflowContext = await loadWorkflowEvaluationContext(session.user.id);
  } catch (error) {
    console.error("Failed to load workflow evaluation context:", error);
  }

  const checklistItemIds = userItems.map((i) => i.id);
  const linkedAppointments =
    checklistItemIds.length === 0
      ? []
      : await prisma.appointment.findMany({
          where: { participantChecklistItemId: { in: checklistItemIds } },
        });
  const appointmentByChecklistItemId = new Map(
    linkedAppointments
      .filter((a) => a.participantChecklistItemId != null)
      .map((a) => [a.participantChecklistItemId as string, a])
  );
  const byTemplate = new Map(userItems.map((i) => [i.templateId, i]));
  const templateByKey = new Map(templates.map((t) => [t.key, t]));
  const renderedBookingGroups = new Set<string>();

  function stepAvailability(checklistKey: string) {
    if (!workflowContext) {
      return {
        locked: true,
        available: false,
        completed: false,
        reasons: [
          profile
            ? "Study progress could not be loaded. Please refresh the page."
            : "Participant profile not found",
        ],
      };
    }
    return evaluateStepAvailability(checklistKey, workflowContext);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your checklist</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Complete each item as you progress through the study.
        </p>
      </div>

      <div className="space-y-3">
        {templates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-slate-600 dark:text-slate-400">
              <p>No checklist items yet.</p>
              <p className="mt-2 text-sm">
                Your study coordinator will add requirements here.
              </p>
            </CardContent>
          </Card>
        ) : (
          templates.map((t) => {
            if (
              isBookAppointmentsGroupKey(t.completionGroupKey) &&
              renderedBookingGroups.has(BOOK_APPOINTMENTS_GROUP_KEY)
            ) {
              return null;
            }

            if (isBookAppointmentsGroupKey(t.completionGroupKey)) {
              renderedBookingGroups.add(BOOK_APPOINTMENTS_GROUP_KEY);

              const rows = BOOK_APPOINTMENT_ROWS.flatMap((config) => {
                const tmpl = templateByKey.get(config.templateKey);
                if (!tmpl) return [];
                const item = byTemplate.get(tmpl.id);
                const linkedAppointment = item
                  ? appointmentByChecklistItemId.get(item.id)
                  : undefined;
                return [
                  {
                    config,
                    templateId: tmpl.id,
                    checklistItemId: item?.id ?? null,
                    templateTitle: tmpl.title,
                    templateDescription: tmpl.description ?? null,
                    status: item?.status ?? "PENDING",
                    bookingProgress:
                      item?.bookingProgress ?? "NOT_STARTED",
                    appointment: linkedAppointment
                      ? {
                          id: linkedAppointment.id,
                          title: linkedAppointment.title,
                          description: linkedAppointment.description,
                          scheduledStartAt:
                            linkedAppointment.scheduledStartAt?.toISOString() ??
                            null,
                          scheduledLocation:
                            linkedAppointment.scheduledLocation,
                          location: linkedAppointment.location,
                          startAt: linkedAppointment.startAt.toISOString(),
                          externalUrl: linkedAppointment.externalUrl,
                        }
                      : null,
                  },
                ];
              });

              const groupComplete = rows.every(
                (r) =>
                  r.bookingProgress === "CONFIRMED" || r.status === "COMPLETED"
              );
              const groupAvailability = stepAvailability(
                BOOK_APPOINTMENT_ROWS[0].templateKey
              );
              const isLocked = !groupComplete && groupAvailability.locked;

              return (
                <ChecklistBookingGroupCard
                  key={BOOK_APPOINTMENTS_GROUP_KEY}
                  title={BOOK_GROUP_HEADER.title}
                  description={BOOK_GROUP_HEADER.description}
                  rows={rows}
                  isComplete={groupComplete}
                  isLocked={isLocked}
                  lockReasons={groupAvailability.reasons}
                />
              );
            }

            const item = byTemplate.get(t.id);
            const linkedAppointment = item
              ? appointmentByChecklistItemId.get(item.id)
              : undefined;
            const status = item?.status ?? "PENDING";
            const dueDate =
              t.dueOffsetDays != null
                ? (() => {
                    const d = new Date(enrollmentDate);
                    d.setDate(d.getDate() + t.dueOffsetDays!);
                    return d;
                  })()
                : null;

            const availability = stepAvailability(t.key);

            const isComplete =
              status === "COMPLETED" || availability.completed;
            const isLocked = !isComplete && availability.locked;
            const surveyUrl =
              t.redcapUrl?.trim() || REDCAP_PRE_SCREENING_SURVEY_URL;

            return (
              <Card
                key={t.id}
                className={
                  isComplete ? "border-violet-200 dark:border-violet-800" : ""
                }
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                  <div className="flex gap-3">
                    <div
                      className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        isComplete
                          ? "bg-violet-600 text-white"
                          : "border border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {isComplete ? <Check className="h-4 w-4" /> : null}
                    </div>
                    <div>
                      <CardTitle className="text-base">{t.title}</CardTitle>
                      {t.description && (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                          {t.description}
                        </p>
                      )}
                      {dueDate && (
                        <p className="mt-1 text-xs text-slate-500">
                          Due: {dueDate.toLocaleDateString()}
                        </p>
                      )}
                      {isLocked ? (
                        <ChecklistLockReasons reasons={availability.reasons} />
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 pt-0">
                  {!isComplete && t.externalUrl ? (
                    <ChecklistExternalBookingFlow
                      templateId={t.id}
                      checklistItemId={item?.id ?? null}
                      templateTitle={t.title}
                      templateDescription={t.description ?? null}
                      externalUrl={t.externalUrl}
                      bookingProgress={item?.bookingProgress ?? "NOT_STARTED"}
                      actionsDisabled={isLocked}
                      appointment={
                        linkedAppointment
                          ? {
                              id: linkedAppointment.id,
                              title: linkedAppointment.title,
                              description: linkedAppointment.description,
                              scheduledStartAt:
                                linkedAppointment.scheduledStartAt?.toISOString() ??
                                null,
                              scheduledLocation:
                                linkedAppointment.scheduledLocation,
                              location: linkedAppointment.location,
                              startAt: linkedAppointment.startAt.toISOString(),
                              externalUrl: linkedAppointment.externalUrl,
                            }
                          : null
                      }
                    />
                  ) : null}
                  {!isComplete && t.type === "SURVEY" ? (
                    <ChecklistSurveySheet
                      templateId={t.id}
                      surveyUrl={surveyUrl}
                      disabled={isLocked}
                    />
                  ) : null}
                  {!isComplete && !t.externalUrl && t.type !== "SURVEY" ? (
                    <MarkCompleteButton
                      templateId={t.id}
                      disabled={isLocked}
                    />
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
