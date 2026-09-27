import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireActiveParticipantPage } from "@/lib/participant-page-access";
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
import {
  ChecklistCollapsibleSection,
  ChecklistOpenSection,
  ChecklistShowMore,
} from "@/components/checklist/checklist-section";
import { ChecklistLevelLabel } from "@/components/checklist/checklist-level-label";
import { ChecklistCelebrationRoot } from "@/components/checklist/level-complete-celebration";
import { LevelCompleteBanner } from "@/components/checklist/level-complete-banner";
import {
  getLevel1EnrollmentDueLabel,
  getLevel1SummaryText,
} from "@/components/checklist/level-1-enrollment-due-label";
import { ChecklistAvailabilityNote } from "@/components/checklist/checklist-availability-note";
import { ChecklistSurveyWindowNote } from "@/components/checklist/checklist-survey-window-note";
import { Check } from "lucide-react";
import { getChecklistDueDisplay } from "@/lib/checklist/checklist-due-display";
import {
  computeUnlockAfterDays,
  computeUnlockAfterMonths,
  FOLLOW_UP_ENROLLMENT_MISSING_TEXT,
  followUpAvailableFromText,
  getSurveyWindow,
  surveyWindowTestLabel,
} from "@/lib/checklist/follow-up-availability";
import { getFollowUpUnlockMonths } from "@/lib/checklist/protocol-timing";
import {
  closingSoonSummaryText,
  collectChecklistCardSlots,
  groupChecklistCards,
  showsDueDate,
  type ChecklistCardEntry,
  type ChecklistTimeGate,
} from "@/lib/checklist/checklist-sections";
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

type ChecklistTemplateRow = Awaited<
  ReturnType<typeof prisma.checklistTemplate.findMany>
>[number];

type ParticipantItemRow = Awaited<
  ReturnType<typeof prisma.participantChecklistItem.findMany>
>[number] & { id: string; template: { key: string } };

type LinkedAppointmentRow = Awaited<
  ReturnType<typeof prisma.appointment.findMany>
>[number];

type UnlockState = {
  unlocked: boolean;
  reasons: string[];
  timing: string | null;
  timeGate: ChecklistTimeGate;
  prerequisitesMet: boolean;
};

type ChecklistCard = ChecklistCardEntry & {
  render: (opts: { showDue: boolean }) => ReactNode;
};

function isBookingProgressUnlocked(progress: ChecklistBookingProgress): boolean {
  return progress === "CONFIRMED" || progress === "BOOKED_EXTERNALLY";
}

/**
 * Calendar timing gate. Follow-up keys use protocol-timing months; the note is shown
 * with a clock rather than as a lock reason.
 */
function timeGate(
  template: ChecklistTemplateRow,
  ctx: { enrollmentDate: Date | null; enrollmentDateMissing: boolean; now: Date }
): { gate: ChecklistTimeGate; text: string | null } {
  const months = getFollowUpUnlockMonths(template.key);
  const days =
    months == null && template.unlockOffsetDays != null && template.unlockOffsetDays > 0
      ? template.unlockOffsetDays
      : null;
  if (months == null && days == null) return { gate: { kind: "open" }, text: null };
  if (!ctx.enrollmentDate || ctx.enrollmentDateMissing) {
    return {
      gate: { kind: "enrollment_date_missing" },
      text: FOLLOW_UP_ENROLLMENT_MISSING_TEXT,
    };
  }
  const unlock =
    months != null
      ? computeUnlockAfterMonths(ctx.enrollmentDate, months)
      : computeUnlockAfterDays(ctx.enrollmentDate, days!);
  return ctx.now < unlock.unlocksAt
    ? {
        gate: { kind: "opens_later", opensAt: unlock.unlocksAt },
        text: followUpAvailableFromText(unlock),
      }
    : { gate: { kind: "open" }, text: null };
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
): UnlockState {
  const reasons: string[] = [];
  const { gate, text: timing } = timeGate(template, ctx);

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

  return {
    unlocked: reasons.length === 0 && gate.kind === "open",
    reasons,
    timing,
    timeGate: gate,
    prerequisitesMet: reasons.length === 0,
  };
}

const OPEN_UNLOCK_STATE: UnlockState = {
  unlocked: true,
  reasons: [],
  timing: null,
  timeGate: { kind: "open" },
  prerequisitesMet: true,
};

export default async function ChecklistPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireActiveParticipantPage(session);

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
  const bookUltrasoundTemplate = templateByKey.get("book_ultrasound");
  const bookUltrasoundItem = bookUltrasoundTemplate
    ? byTemplate.get(bookUltrasoundTemplate.id)
    : undefined;
  const ultrasoundAppointmentAt = bookUltrasoundItem
    ? getUltrasoundAppointmentDateTime(
        appointmentByChecklistItemId.get(bookUltrasoundItem.id)
      )
    : null;
  const completedTemplateKeys = new Set(
    userItems
      .filter((i) => i.status === "COMPLETED")
      .map((i) => i.template.key)
  );
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

  function buildChecklistCard(
    t: ChecklistTemplateRow,
    options: {
      levelLabel: string;
      order: number;
    }
  ): ChecklistCard | null {
    const groupKey = t.completionGroupKey;
    if (isKnownBookingGroupKey(groupKey)) {
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
        : OPEN_UNLOCK_STATE;
      const allBookingRowsComplete =
        rows.length > 0 && rows.every((row) => row.status === "COMPLETED");
      const groupDueLabel = !allBookingRowsComplete
        ? getLevel1EnrollmentDueLabel({
            templateKey: groupDef.unlockTemplateKey,
            enrollmentDate: enrollmentTiming.enrollmentDate,
            enrollmentDateMissing: enrollmentTiming.missing,
            now: unlockCtx.now,
          })
        : null;

      const header = BOOK_GROUP_HEADERS[groupKey];

      return {
        key: groupKey,
        title: header.title,
        order: options.order,
        completed: allBookingRowsComplete,
        timeGate: groupUnlock.timeGate,
        prerequisitesMet: groupUnlock.prerequisitesMet,
        surveyWindow: null,
        render: ({ showDue }) => (
          <ChecklistBookingGroupCard
            key={groupKey}
            title={header.title}
            description={header.description}
            rows={rows}
            isLocked={!groupUnlock.unlocked}
            lockReasons={groupUnlock.reasons}
            dueLabel={showDue ? groupDueLabel : null}
            availabilityNote={allBookingRowsComplete ? null : groupUnlock.timing}
            levelLabel={options.levelLabel}
          />
        ),
      };
    }

    const item = byTemplate.get(t.id);
    const linkedAppointment = item
      ? appointmentByChecklistItemId.get(item.id)
      : undefined;
    const status = item?.status ?? "PENDING";
    const dueLabel =
      getChecklistDueDisplay({
        templateKey: t.key,
        completedAtByKey,
        ultrasoundAppointmentAt,
      }).recommendedLabel ??
      getLevel1EnrollmentDueLabel({
        templateKey: t.key,
        enrollmentDate: enrollmentTiming.enrollmentDate,
        enrollmentDateMissing: enrollmentTiming.missing,
        now: unlockCtx.now,
      });

    const unlock = isUnlocked(t, unlockCtx);
    const surveyWindow =
      enrollmentTiming.enrollmentDate && !enrollmentTiming.missing
        ? getSurveyWindow(t.key, enrollmentTiming.enrollmentDate, unlockCtx.now)
        : null;
    const isComplete = status === "COMPLETED";
    const isLocked = !isComplete && !unlock.unlocked;
    const actionsDisabled = isLocked;
    const surveyUrl = t.redcapUrl?.trim() || REDCAP_PRE_SCREENING_SURVEY_URL;
    const cardTitle =
      t.key === "ultrasound_completed"
        ? ULTRASOUND_COMPLETED_UI.title
        : t.title;
    const cardDescription =
      t.key === "ultrasound_completed"
        ? ULTRASOUND_COMPLETED_UI.description
        : t.description;

    return {
      key: t.key,
      title: cardTitle,
      order: options.order,
      completed: isComplete,
      timeGate: unlock.timeGate,
      prerequisitesMet: unlock.prerequisitesMet,
      surveyWindow: surveyWindow
        ? { state: surveyWindow.state, daysLeft: surveyWindow.daysLeft }
        : null,
      render: ({ showDue }) => (
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
              <ChecklistLevelLabel label={options.levelLabel} />
              <CardTitle className={cn("flex items-center gap-2 text-base", participantDashboardHeadingClassName)}>
                {cardTitle}
              </CardTitle>
              {cardDescription && (
                <p className={cn("mt-1 text-sm", participantDashboardMutedClassName)}>
                  {cardDescription}
                </p>
              )}
              {showDue && dueLabel && !isComplete ? (
                <p className="mt-1 text-xs text-[#2F8F7A]">
                  {dueLabel}
                </p>
              ) : null}
              {!isComplete && surveyWindow ? (
                <ChecklistSurveyWindowNote
                  surveyWindow={surveyWindow}
                  testLabel={surveyWindowTestLabel()}
                />
              ) : !isComplete && unlock.timing ? (
                <ChecklistAvailabilityNote text={unlock.timing} />
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
      ),
    };
  }

  const cards: ChecklistCard[] = [];
  const cardSlots = collectChecklistCardSlots(
    [
      { templates: level1Templates, levelLabel: "Level 1" },
      { templates: level2Templates, levelLabel: "Level 2" },
      { templates: level3Templates, levelLabel: "Level 3" },
    ],
    isKnownBookingGroupKey
  );
  for (const { template, level } of cardSlots) {
    const card = buildChecklistCard(template, {
      levelLabel: level.levelLabel,
      order: cards.length,
    });
    if (card) cards.push(card);
  }
  const sections = groupChecklistCards(cards);
  const renderCard = (c: ChecklistCard) =>
    c.render({ showDue: showsDueDate(sections.sectionOf.get(c.key)) });
  const level1Summary = getLevel1SummaryText({
    completedCount: LEVEL_1_REQUIRED_TEMPLATE_KEYS.filter((key) =>
      completedTemplateKeys.has(key)
    ).length,
    totalCount: LEVEL_1_REQUIRED_TEMPLATE_KEYS.length,
    enrollmentDate: enrollmentTiming.enrollmentDate,
    enrollmentDateMissing: enrollmentTiming.missing,
    now: unlockCtx.now,
  });

  const levelBanners = [
    { show: showLevel1CongratsBanner, type: "level_1_complete" as const },
    { show: showLevel2CongratsBanner, type: "level_2_complete" as const },
    { show: showLevel3CongratsBanner, type: "level_3_complete" as const },
  ].filter((b) => b.show);

  return (
    <ChecklistCelebrationRoot>
    <div className={participantDashboardPageClassName}>
      <div>
        <h1 className={participantDashboardPageTitleClassName}>Your checklist</h1>
        <p className="text-[#17483F]">
          Complete each item as you progress through the study.
        </p>
      </div>

      {levelBanners.map((b) => (
        <LevelCompleteBanner
          key={b.type}
          notificationId={unreadLevelCompleteNotificationByType.get(b.type)!}
          message={LEVEL_COMPLETE_NOTIFICATION_COPY[b.type]}
        />
      ))}

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
              <p
                key="level-1-summary"
                className={cn(
                  "rounded-2xl border border-[#2F8F7A]/20 bg-white/85 px-4 py-3 text-sm font-medium",
                  participantDashboardHeadingClassName
                )}
              >
                {level1Summary}
              </p>
            ) : null}
            <ChecklistOpenSection
              key="todo"
              id="checklist-todo"
              title="To do now"
              count={sections.todo.length}
            >
              {sections.todo.length === 0 ? (
                <p className={cn("text-sm", participantDashboardMutedClassName)}>
                  No tasks need your action right now.
                </p>
              ) : (
                sections.todoVisible.map(renderCard)
              )}
              {sections.todoHiddenClosingSoon.length > 0 ? (
                <p className="text-sm text-[#17483F]">
                  Also closing soon:{" "}
                  {sections.todoHiddenClosingSoon
                    .map(closingSoonSummaryText)
                    .join("; ")}
                </p>
              ) : null}
              {sections.todoHidden.length > 0 ? (
                <ChecklistShowMore hiddenCount={sections.todoHidden.length}>
                  {sections.todoHidden.map(renderCard)}
                </ChecklistShowMore>
              ) : null}
            </ChecklistOpenSection>
            {sections.comingUp.length > 0 ? (
              <ChecklistOpenSection
                key="coming-up"
                id="checklist-coming-up"
                title="Coming up next"
                count={sections.comingUp.length}
              >
                {sections.comingUp.map(renderCard)}
              </ChecklistOpenSection>
            ) : null}
            {sections.waiting.length > 0 ? (
              <ChecklistCollapsibleSection
                key="waiting"
                title="Waiting for another step"
                count={sections.waiting.length}
                description="These unlock once an earlier step is done. Each card says what is needed."
              >
                {sections.waiting.map(renderCard)}
              </ChecklistCollapsibleSection>
            ) : null}
            {sections.later.length > 0 ? (
              <ChecklistCollapsibleSection
                key="later"
                title="Later in the study"
                count={sections.later.length}
              >
                {sections.later.map(renderCard)}
              </ChecklistCollapsibleSection>
            ) : null}
            {sections.completed.length > 0 ? (
              <ChecklistCollapsibleSection
                key="completed"
                title="Completed"
                count={sections.completed.length}
              >
                {sections.completed.map(renderCard)}
              </ChecklistCollapsibleSection>
            ) : null}
          </>
        )}
      </div>
    </div>
    </ChecklistCelebrationRoot>
  );
}
