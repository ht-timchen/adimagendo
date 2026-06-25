import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { REDCAP_PRE_SCREENING_SURVEY_URL } from "@/lib/redcap";
import type { ChecklistBookingProgress } from "@/components/checklist-external-booking-flow";
import {
  BOOK_APPOINTMENTS_GROUP_KEY,
  BOOK_APPOINTMENTS_3Y_GROUP_KEY,
  getBookingGroupDefinition,
  isKnownBookingGroupKey,
} from "@/lib/checklist-booking-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkCompleteButton } from "@/components/checklist-mark-complete";
import { ChecklistSurveySheet } from "@/components/checklist-survey-sheet";
import { ChecklistExternalBookingFlow } from "@/components/checklist-external-booking-flow";
import { ChecklistLockReasons } from "@/components/checklist-lock-reasons";
import { ChecklistBookingGroupCard } from "@/components/checklist-booking-group-card";
import { ChecklistLevel1Section } from "@/components/checklist/checklist-level-1-section";
import { ChecklistLevel2Section } from "@/components/checklist/checklist-level-2-section";
import { ChecklistLevel3Section } from "@/components/checklist/checklist-level-3-section";
import { ChecklistCelebrationRoot } from "@/components/checklist/level-complete-celebration";
import { LevelCompleteBanner } from "@/components/checklist/level-complete-banner";
import { getLevel1EnrollmentDueLabel, getTemplateEnrollmentDueLabel } from "@/components/checklist/level-1-enrollment-due-label";
import { Check, Lock } from "lucide-react";
import { getChecklistDueDisplay } from "@/lib/checklist/checklist-due-display";
import { cn } from "@/lib/utils";
import {
  participantDashboardCardClassName,
  participantDashboardHeadingClassName,
  participantDashboardMutedClassName,
  participantDashboardPageClassName,
  participantDashboardPageTitleClassName,
} from "@/lib/participant-dashboard-ui";
import { LEVEL_COMPLETE_NOTIFICATION_COPY } from "@/lib/checklist/level-complete-notifications";
import { LEVEL_1_REQUIRED_TEMPLATE_KEYS } from "@/lib/checklist/early-clinical-protocol";
import { isLevel1Complete } from "@/lib/checklist/level1-follow-up";
import {
  isLevel2Complete,
  isLevel3Complete,
  LEVEL_2_REQUIRED_TEMPLATE_KEYS,
  LEVEL_3_REQUIRED_TEMPLATE_KEYS,
} from "@/lib/checklist/level2-follow-up";
import {
  MISSING_ENROLLMENT_DATE_MESSAGE,
  resolveEnrollmentDateForTiming,
} from "@/lib/checklist/enrollment-date-for-timing";
import {
  getUltrasoundAppointmentDateTime,
  isPreTvusUltrasoundBookingPrerequisiteMet,
  preTvusUltrasoundBookingLockReason,
} from "@/lib/checklist/pre-tvus-ultrasound-prerequisite";
import type { ReactNode } from "react";

const LEVEL_1_KEY_SET = new Set<string>(LEVEL_1_REQUIRED_TEMPLATE_KEYS);
const LEVEL_2_KEY_SET = new Set<string>(LEVEL_2_REQUIRED_TEMPLATE_KEYS);
const LEVEL_3_KEY_SET = new Set<string>(LEVEL_3_REQUIRED_TEMPLATE_KEYS);

const BOOK_GROUP_HEADER = {
  title: "Book your appointments",
  description:
    "Book your ultrasound, MRI, and blood test appointments. These can be booked in any order. Your Pre-TVUS survey will unlock once your ultrasound appointment date and time are confirmed.",
};

const BOOK_GROUP_3Y_HEADER = {
  title: "Book your 2.5-year appointments",
  description:
    "Book your ultrasound and MRI appointments for the long-term follow-up window. These can be booked in any order.",
};

const BOOK_GROUP_HEADERS: Record<
  string,
  { title: string; description: string }
> = {
  [BOOK_APPOINTMENTS_GROUP_KEY]: BOOK_GROUP_HEADER,
  [BOOK_APPOINTMENTS_3Y_GROUP_KEY]: BOOK_GROUP_3Y_HEADER,
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

  const [templates, userItems, levelCompleteNotifications] = await Promise.all([
    prisma.checklistTemplate.findMany({
      orderBy: { sortOrder: "asc" },
    }),
    prisma.participantChecklistItem.findMany({
      where: { userId: session.user.id },
      include: { template: true },
    }),
    prisma.notification.findMany({
      where: {
        userId: session.user.id,
        type: {
          in: ["level_1_complete", "level_2_complete", "level_3_complete"],
        },
        read: false,
      },
      select: { id: true, type: true },
    }),
  ]);

  const unreadLevelCompleteNotificationByType = new Map(
    levelCompleteNotifications
      .filter(
        (n): n is { id: string; type: string } =>
          n.type != null &&
          (n.type === "level_1_complete" ||
            n.type === "level_2_complete" ||
            n.type === "level_3_complete")
      )
      .map((n) => [n.type, n.id] as const)
  );

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
  const completedTemplateKeys = new Set(
    userItems
      .filter((i) => i.status === "COMPLETED")
      .map((i) => i.template.key)
  );
  const level1CompletedCount = LEVEL_1_REQUIRED_TEMPLATE_KEYS.filter((key) =>
    completedTemplateKeys.has(key)
  ).length;
  const level2CompletedCount = LEVEL_2_REQUIRED_TEMPLATE_KEYS.filter((key) =>
    completedTemplateKeys.has(key)
  ).length;
  const level3CompletedCount = LEVEL_3_REQUIRED_TEMPLATE_KEYS.filter((key) =>
    completedTemplateKeys.has(key)
  ).length;
  const level1Complete = isLevel1Complete(completedTemplateKeys);
  const level2Complete = isLevel2Complete(completedTemplateKeys);
  const level3Complete = isLevel3Complete(completedTemplateKeys);
  const level1Templates = templates.filter((t) => LEVEL_1_KEY_SET.has(t.key));
  const level2Templates = templates.filter((t) => LEVEL_2_KEY_SET.has(t.key));
  const level3Templates = templates.filter((t) => LEVEL_3_KEY_SET.has(t.key));
  const showLevel1CongratsBanner =
    level1Complete &&
    unreadLevelCompleteNotificationByType.has("level_1_complete");
  const showLevel2CongratsBanner =
    level2Complete &&
    unreadLevelCompleteNotificationByType.has("level_2_complete");
  const showLevel3CongratsBanner =
    level3Complete &&
    unreadLevelCompleteNotificationByType.has("level_3_complete");

  function renderChecklistItem(
    t: ChecklistTemplateRow,
    options: {
      useLevel1Due: boolean;
      sectionLocked?: boolean;
      renderedBookingGroups: Set<string>;
    }
  ): ReactNode {
    const groupKey = t.completionGroupKey;
    if (isKnownBookingGroupKey(groupKey)) {
      if (options.renderedBookingGroups.has(groupKey)) {
        return null;
      }

      options.renderedBookingGroups.add(groupKey);

      const groupDef = getBookingGroupDefinition(groupKey);
      if (!groupDef) return null;

      const rows = groupDef.rows.flatMap((config) => {
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
            bookingProgress: item?.bookingProgress ?? "NOT_STARTED",
            appointment: linkedAppointment
              ? {
                  id: linkedAppointment.id,
                  title: linkedAppointment.title,
                  description: linkedAppointment.description,
                  scheduledStartAt:
                    linkedAppointment.scheduledStartAt?.toISOString() ?? null,
                  scheduledLocation: linkedAppointment.scheduledLocation,
                  location: linkedAppointment.location,
                  startAt: linkedAppointment.startAt.toISOString(),
                  externalUrl: linkedAppointment.externalUrl,
                }
              : null,
          },
        ];
      });

      const unlockTemplate = templateByKey.get(groupDef.unlockTemplateKey);
      const groupUnlock = unlockTemplate
        ? isUnlocked(unlockTemplate, unlockCtx)
        : { unlocked: true, reasons: [] as string[] };
      const sectionLocked = options.sectionLocked ?? false;
      const allBookingRowsComplete =
        rows.length > 0 && rows.every((row) => row.status === "COMPLETED");
      const groupDueLabel =
        !sectionLocked && !allBookingRowsComplete && unlockTemplate
          ? options.useLevel1Due
            ? getLevel1EnrollmentDueLabel({
                enrollmentDate: enrollmentTiming.enrollmentDate,
                dueOffsetDays: unlockTemplate.dueOffsetDays,
                enrollmentDateMissing: enrollmentTiming.missing,
              })
            : getTemplateEnrollmentDueLabel({
                enrollmentDate: enrollmentTiming.enrollmentDate,
                dueOffsetDays: unlockTemplate.dueOffsetDays,
                unlockOffsetDays: unlockTemplate.unlockOffsetDays,
                enrollmentDateMissing: enrollmentTiming.missing,
              })
          : null;

      const header = BOOK_GROUP_HEADERS[groupKey];

      return (
        <ChecklistBookingGroupCard
          key={groupKey}
          title={header.title}
          description={header.description}
          rows={rows}
          isLocked={sectionLocked || !groupUnlock.unlocked}
          lockReasons={sectionLocked ? [] : groupUnlock.reasons}
          dueLabel={groupDueLabel}
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
    const dueLabel = options.useLevel1Due
      ? getLevel1EnrollmentDueLabel({
          enrollmentDate: enrollmentTiming.enrollmentDate,
          dueOffsetDays: t.dueOffsetDays,
          enrollmentDateMissing: enrollmentTiming.missing,
        })
      : dueDisplay.recommendedLabel ??
        getTemplateEnrollmentDueLabel({
          enrollmentDate: enrollmentTiming.enrollmentDate,
          dueOffsetDays: t.dueOffsetDays,
          unlockOffsetDays: t.unlockOffsetDays,
          enrollmentDateMissing: enrollmentTiming.missing,
        });

    const unlock = isUnlocked(t, unlockCtx);
    const isComplete = status === "COMPLETED";
    const isLocked = !isComplete && !unlock.unlocked;
    const sectionLocked = options.sectionLocked ?? false;
    const actionsDisabled = sectionLocked || isLocked;
    const surveyUrl = t.redcapUrl?.trim() || REDCAP_PRE_SCREENING_SURVEY_URL;
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
        className={cn(
          participantDashboardCardClassName,
          isComplete && "border-[#2F8F7A]/40"
        )}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
          <div className="flex gap-3">
            <div
              className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                isComplete
                  ? "bg-brand text-white"
                  : "border border-[#2F8F7A]/30"
              }`}
            >
              {isComplete ? <Check className="h-4 w-4" /> : null}
            </div>
            <div>
              <CardTitle className={cn("flex items-center gap-2 text-base", participantDashboardHeadingClassName)}>
                {sectionLocked && !isComplete ? (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-[#2A6F60]" />
                ) : null}
                {cardTitle}
              </CardTitle>
              {cardDescription && (
                <p className={cn("mt-1 text-sm", participantDashboardMutedClassName)}>
                  {cardDescription}
                </p>
              )}
              {dueLabel && !isComplete && !sectionLocked ? (
                <p className="mt-1 text-xs text-[#2F8F7A]">
                  {dueLabel}
                </p>
              ) : null}
              {isLocked && !sectionLocked ? (
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
              actionsDisabled={actionsDisabled}
              appointment={
                linkedAppointment
                  ? {
                      id: linkedAppointment.id,
                      title: linkedAppointment.title,
                      description: linkedAppointment.description,
                      scheduledStartAt:
                        linkedAppointment.scheduledStartAt?.toISOString() ??
                        null,
                      scheduledLocation: linkedAppointment.scheduledLocation,
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
              disabled={actionsDisabled}
            />
          ) : null}
          {!isComplete && !t.externalUrl && t.type !== "SURVEY" ? (
            <MarkCompleteButton
              templateId={t.id}
              disabled={actionsDisabled}
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
  }

  const level1RenderedBookingGroups = new Set<string>();
  const level2RenderedBookingGroups = new Set<string>();
  const level3RenderedBookingGroups = new Set<string>();

  return (
    <ChecklistCelebrationRoot>
    <div className={participantDashboardPageClassName}>
      <div>
        <h1 className={participantDashboardPageTitleClassName}>Your checklist</h1>
        <p className="text-[#17483F]">
          Complete each item as you progress through the study.
        </p>
      </div>

      {enrollmentTiming.missing ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-950">
            {MISSING_ENROLLMENT_DATE_MESSAGE}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {templates.length === 0 ? (
          <Card className={participantDashboardCardClassName}>
            <CardContent className={cn("py-8 text-center", participantDashboardMutedClassName)}>
              <p>No checklist items yet.</p>
              <p className="mt-2 text-sm">
                Your study coordinator will add requirements here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {level1Templates.length > 0 ? (
              <div className="space-y-3">
                {showLevel1CongratsBanner ? (
                  <LevelCompleteBanner
                    notificationId={
                      unreadLevelCompleteNotificationByType.get(
                        "level_1_complete"
                      )!
                    }
                    message={LEVEL_COMPLETE_NOTIFICATION_COPY.level_1_complete}
                  />
                ) : null}
                <ChecklistLevel1Section
                  completedCount={level1CompletedCount}
                  totalCount={LEVEL_1_REQUIRED_TEMPLATE_KEYS.length}
                  enrollmentDate={enrollmentTiming.enrollmentDate}
                  enrollmentDateMissing={enrollmentTiming.missing}
                >
                  {level1Templates.map((t) =>
                    renderChecklistItem(t, {
                      useLevel1Due: true,
                      renderedBookingGroups: level1RenderedBookingGroups,
                    })
                  )}
                </ChecklistLevel1Section>
              </div>
            ) : null}
            {level2Templates.length > 0 ? (
              <div className="space-y-3">
                {showLevel2CongratsBanner ? (
                  <LevelCompleteBanner
                    notificationId={
                      unreadLevelCompleteNotificationByType.get(
                        "level_2_complete"
                      )!
                    }
                    message={LEVEL_COMPLETE_NOTIFICATION_COPY.level_2_complete}
                  />
                ) : null}
                <ChecklistLevel2Section
                  unlocked={level1Complete}
                  completedCount={level2CompletedCount}
                  totalCount={LEVEL_2_REQUIRED_TEMPLATE_KEYS.length}
                  enrollmentDate={enrollmentTiming.enrollmentDate}
                  enrollmentDateMissing={enrollmentTiming.missing}
                >
                  {level2Templates.map((t) =>
                    renderChecklistItem(t, {
                      useLevel1Due: false,
                      sectionLocked: !level1Complete,
                      renderedBookingGroups: level2RenderedBookingGroups,
                    })
                  )}
                </ChecklistLevel2Section>
              </div>
            ) : null}
            {level3Templates.length > 0 ? (
              <div className="space-y-3">
                {showLevel3CongratsBanner ? (
                  <LevelCompleteBanner
                    notificationId={
                      unreadLevelCompleteNotificationByType.get(
                        "level_3_complete"
                      )!
                    }
                    message={LEVEL_COMPLETE_NOTIFICATION_COPY.level_3_complete}
                  />
                ) : null}
                <ChecklistLevel3Section
                  unlocked={level2Complete}
                  completedCount={level3CompletedCount}
                  totalCount={LEVEL_3_REQUIRED_TEMPLATE_KEYS.length}
                  enrollmentDate={enrollmentTiming.enrollmentDate}
                  enrollmentDateMissing={enrollmentTiming.missing}
                >
                  {level3Templates.map((t) =>
                    renderChecklistItem(t, {
                      useLevel1Due: false,
                      sectionLocked: !level2Complete,
                      renderedBookingGroups: level3RenderedBookingGroups,
                    })
                  )}
                </ChecklistLevel3Section>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
    </ChecklistCelebrationRoot>
  );
}
