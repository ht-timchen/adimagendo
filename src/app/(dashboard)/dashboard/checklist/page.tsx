import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { REDCAP_PRE_SCREENING_SURVEY_URL } from "@/lib/redcap";
import type { ChecklistBookingProgress } from "@/components/checklist-external-booking-flow";
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
import { getChecklistDueDisplay } from "@/lib/checklist/checklist-due-display";
import {
  MISSING_ENROLLMENT_DATE_MESSAGE,
  resolveEnrollmentDateForTiming,
} from "@/lib/checklist/enrollment-date-for-timing";
import {
  getUltrasoundAppointmentDateTime,
  isPreTvusUltrasoundBookingPrerequisiteMet,
  preTvusUltrasoundBookingLockReason,
} from "@/lib/checklist/pre-tvus-ultrasound-prerequisite";

const BOOK_GROUP_HEADER = {
  title: "Book your appointments",
  description:
    "Book your ultrasound, MRI, and blood test appointments. These can be booked in any order. Your Pre-TVUS survey will unlock once your ultrasound appointment date and time are confirmed.",
};

const POST_TVUS_ULTRASOUND_COMPLETE_LOCK_MESSAGE =
  "Confirm your ultrasound is complete to unlock this survey.";

const ULTRASOUND_COMPLETED_UI = {
  title: "Confirm your ultrasound is complete",
  description:
    "After you attend your ultrasound appointment, confirm it here. This will unlock your Post-TVUS survey.",
  buttonLabel: "I have completed my ultrasound",
} as const;

function parsePrerequisiteKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((k): k is string => typeof k === "string");
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

type ChecklistTemplateRow = Awaited<
  ReturnType<typeof prisma.checklistTemplate.findMany>
>[number];

type ParticipantItemRow = Awaited<
  ReturnType<typeof prisma.participantChecklistItem.findMany>
>[number] & { id: string; template: { key: string } };

type LinkedAppointmentRow = Awaited<
  ReturnType<typeof prisma.appointment.findMany>
>[number];

function isBookingProgressUnlocked(progress: ChecklistBookingProgress): boolean {
  return progress === "CONFIRMED" || progress === "BOOKED_EXTERNALLY";
}

function isUnlocked(
  template: ChecklistTemplateRow,
  ctx: {
    enrollmentDate: Date | null;
    enrollmentDateMissing: boolean;
    now: Date;
    templateByKey: Map<string, ChecklistTemplateRow>;
    itemByTemplateId: Map<string, ParticipantItemRow>;
    appointmentByChecklistItemId: Map<string, LinkedAppointmentRow>;
  }
): { unlocked: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (template.unlockOffsetDays != null && template.unlockOffsetDays > 0) {
    if (!ctx.enrollmentDate || ctx.enrollmentDateMissing) {
      reasons.push(MISSING_ENROLLMENT_DATE_MESSAGE);
    } else {
      const unlockAt = startOfDay(ctx.enrollmentDate);
      unlockAt.setDate(unlockAt.getDate() + template.unlockOffsetDays);
      if (startOfDay(ctx.now) < unlockAt) {
        reasons.push(
          `Available from ${unlockAt.toLocaleDateString()} (${template.unlockOffsetDays} days after enrollment)`
        );
      }
    }
  }

  if (template.bookingPrerequisiteKey) {
    const bookingTemplate = ctx.templateByKey.get(template.bookingPrerequisiteKey);
    if (!bookingTemplate) {
      reasons.push(
        `Missing booking prerequisite configuration: "${template.bookingPrerequisiteKey}"`
      );
    } else {
      const bookingItem = ctx.itemByTemplateId.get(bookingTemplate.id);
      const progress = (bookingItem?.bookingProgress ??
        "NOT_STARTED") as ChecklistBookingProgress;
      const appointmentDateTime = bookingItem
        ? getUltrasoundAppointmentDateTime(
            ctx.appointmentByChecklistItemId.get(bookingItem.id)
          )
        : null;
      const bookingPrerequisiteMet =
        template.key === "pre_tvus_survey" &&
        template.bookingPrerequisiteKey === "book_ultrasound"
          ? isPreTvusUltrasoundBookingPrerequisiteMet({
              bookingProgress: progress,
              appointmentDateTime,
            })
          : isBookingProgressUnlocked(progress);
      if (!bookingPrerequisiteMet) {
        if (
          template.key === "pre_tvus_survey" &&
          template.bookingPrerequisiteKey === "book_ultrasound"
        ) {
          reasons.push(
            preTvusUltrasoundBookingLockReason({
              bookingProgress: progress,
              appointmentDateTime,
            })
          );
        } else {
          reasons.push(`Book ${bookingTemplate.title} first`);
        }
      }
    }
  }

  for (const prereqKey of parsePrerequisiteKeys(template.prerequisiteKeys)) {
    const prereqTemplate = ctx.templateByKey.get(prereqKey);
    if (!prereqTemplate) {
      reasons.push(`Missing prerequisite configuration: "${prereqKey}"`);
      continue;
    }
    const prereqItem = ctx.itemByTemplateId.get(prereqTemplate.id);
    if (prereqItem?.status !== "COMPLETED") {
      if (
        template.key === "post_tvus_survey" &&
        prereqKey === "ultrasound_completed"
      ) {
        reasons.push(POST_TVUS_ULTRASOUND_COMPLETE_LOCK_MESSAGE);
      } else {
        reasons.push(`Complete "${prereqTemplate.title}" first`);
      }
    }
  }

  return { unlocked: reasons.length === 0, reasons };
}

export default async function ChecklistPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const profile = await prisma.participantProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      enrollmentDate: true,
      dataSource: true,
      dataKind: true,
      studyRecordId: true,
    },
  });

  const enrollmentTiming = profile
    ? await resolveEnrollmentDateForTiming(profile)
    : { enrollmentDate: null, missing: true };

  const [templates, userItems] = await Promise.all([
    prisma.checklistTemplate.findMany({
      orderBy: { sortOrder: "asc" },
    }),
    prisma.participantChecklistItem.findMany({
      where: { userId: session.user.id },
      include: { template: true },
    }),
  ]);

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
  const unlockCtx = {
    enrollmentDate: enrollmentTiming.enrollmentDate,
    enrollmentDateMissing: enrollmentTiming.missing,
    now: new Date(),
    templateByKey,
    itemByTemplateId: byTemplate,
    appointmentByChecklistItemId,
  };
  const completedAtByKey = new Map(
    userItems
      .filter((i) => i.status === "COMPLETED" && i.completedAt)
      .map((i) => [i.template.key, i.completedAt] as const)
  );
  const renderedBookingGroups = new Set<string>();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your checklist</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Complete each item as you progress through the study.
        </p>
      </div>

      {enrollmentTiming.missing ? (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="py-4 text-sm text-amber-950 dark:text-amber-100">
            {MISSING_ENROLLMENT_DATE_MESSAGE}
          </CardContent>
        </Card>
      ) : null}

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

              const bookUltrasoundTemplate = templateByKey.get("book_ultrasound");
              const groupUnlock = bookUltrasoundTemplate
                ? isUnlocked(bookUltrasoundTemplate, unlockCtx)
                : { unlocked: true, reasons: [] as string[] };

              return (
                <ChecklistBookingGroupCard
                  key={BOOK_APPOINTMENTS_GROUP_KEY}
                  title={BOOK_GROUP_HEADER.title}
                  description={BOOK_GROUP_HEADER.description}
                  rows={rows}
                  isLocked={!groupUnlock.unlocked}
                  lockReasons={groupUnlock.reasons}
                />
              );
            }

            const item = byTemplate.get(t.id);
            const linkedAppointment = item
              ? appointmentByChecklistItemId.get(item.id)
              : undefined;
            const status = item?.status ?? "PENDING";
            const dueDisplay = getChecklistDueDisplay({
              templateKey: t.key,
              completedAtByKey,
              enrollmentDate: enrollmentTiming.enrollmentDate,
              dueOffsetDays: t.dueOffsetDays,
              enrollmentDateMissing: enrollmentTiming.missing,
            });

            const unlock = isUnlocked(t, unlockCtx);
            const isComplete = status === "COMPLETED";
            const isLocked = !isComplete && !unlock.unlocked;
            const surveyUrl =
              t.redcapUrl?.trim() || REDCAP_PRE_SCREENING_SURVEY_URL;
            const cardTitle =
              t.key === "ultrasound_completed"
                ? ULTRASOUND_COMPLETED_UI.title
                : t.title;
            const cardDescription =
              t.key === "ultrasound_completed"
                ? ULTRASOUND_COMPLETED_UI.description
                : t.description;

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
                      <CardTitle className="text-base">{cardTitle}</CardTitle>
                      {cardDescription && (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                          {cardDescription}
                        </p>
                      )}
                      {dueDisplay.recommendedLabel && !isComplete ? (
                        <p className="mt-1 text-xs text-violet-700 dark:text-violet-300">
                          {dueDisplay.recommendedLabel}
                        </p>
                      ) : null}
                      {isLocked ? (
                        <ChecklistLockReasons reasons={unlock.reasons} />
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 pt-0">
                  {(!isComplete || item?.bookingProgress === "CONFIRMED") &&
                  t.externalUrl ? (
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
                      label={
                        t.key === "ultrasound_completed"
                          ? ULTRASOUND_COMPLETED_UI.buttonLabel
                          : undefined
                      }
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
