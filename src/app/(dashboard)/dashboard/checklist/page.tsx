import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { REDCAP_PRE_SCREENING_SURVEY_URL } from "@/lib/redcap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkCompleteButton } from "@/components/checklist-mark-complete";
import { ChecklistSurveySheet } from "@/components/checklist-survey-sheet";
import { ChecklistExternalBookingFlow } from "@/components/checklist-external-booking-flow";
import { Check } from "lucide-react";

export default async function ChecklistPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const profile = await prisma.participantProfile.findUnique({
    where: { userId: session.user.id },
  });
  const enrollmentDate = profile?.enrollmentDate ?? new Date();

  const templates = await prisma.checklistTemplate.findMany({
    orderBy: { sortOrder: "asc" },
  });
  const userItems = await prisma.participantChecklistItem.findMany({
    where: { userId: session.user.id },
    include: { template: true },
  });
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
            const isComplete = status === "COMPLETED";

            return (
              <Card
                key={t.id}
                className={isComplete ? "border-violet-200 dark:border-violet-800" : ""}
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
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 pt-0">
                  {!isComplete && t.externalUrl && (
                    <ChecklistExternalBookingFlow
                      templateId={t.id}
                      templateTitle={t.title}
                      templateDescription={t.description ?? null}
                      externalUrl={t.externalUrl}
                      bookingProgress={item?.bookingProgress ?? "NOT_STARTED"}
                      bookedExternallyAt={
                        item?.bookedExternallyAt?.toISOString() ?? null
                      }
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
                  )}
                  {!isComplete && t.type === "SURVEY" && (
                    <ChecklistSurveySheet
                      templateId={t.id}
                      surveyUrl={REDCAP_PRE_SCREENING_SURVEY_URL}
                    />
                  )}
                  {!isComplete && !t.externalUrl && (
                    <MarkCompleteButton templateId={t.id} />
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
