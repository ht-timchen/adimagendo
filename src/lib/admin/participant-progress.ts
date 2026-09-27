import type { ChecklistStatus } from "@prisma/client";
import {
  ADMIN_CHECKLIST_STEP_TOTAL,
  ADMIN_LOGICAL_CHECKLIST_STEPS,
  computeAdminChecklistProgress,
  type AdminChecklistProgressItem,
} from "@/lib/admin/checklist-progress";
import {
  getFollowUpOverdueThreshold,
  getFollowUpUnlock,
} from "@/lib/checklist/follow-up-availability";
import { getFollowUpUnlockMonths } from "@/lib/checklist/protocol-timing";
import { getLevel1DueDays } from "@/lib/checklist/early-clinical-protocol";
import {
  addCivilDays,
  adelaideCivilDate,
  adelaideMidnightUtc,
  civilDaysBetween,
  civilWeekday,
  compareCivilDates,
  formatCivilDateDMY,
  type CivilDate,
} from "@/lib/dates/adelaide-calendar";

export type ChecklistTemplateMeta = {
  key: string;
  title: string;
  dueOffsetDays: number | null;
};

export type ParticipantProgressStatus = "withdrawn" | "completed" | "overdue" | "on_track";

export type DueDateTone = "overdue" | "today" | "this_week" | "default" | "none";

export type ParticipantProgressRow = {
  id: string;
  name: string;
  email: string;
  studyRecordId: string;
  detailRecordId: string;
  isActive: boolean;
  completed: number;
  total: number;
  currentPhase: string;
  nextTask: string | null;
  dueDateIso: string | null;
  dueDateLabel: string;
  dueDateTone: DueDateTone;
  daysLate: number | null;
  status: ParticipantProgressStatus;
  hasOverdueItems: boolean;
  sortOverdueRank: number;
  sortDueTimestamp: number;
};

export type ParticipantProgressKpis = {
  overallCompletionPct: number;
  completedItems: number;
  totalItems: number;
  inProgressCount: number;
  overdueCount: number;
  participantCount: number;
};

type ChecklistItemInput = {
  templateKey: string;
  status: ChecklistStatus;
};

function isLogicalStepComplete(templateKeys: string[], completedKeys: Set<string>): boolean {
  return templateKeys.every((key) => completedKeys.has(key));
}

function phaseLabelForStepIndex(index: number): string {
  if (index <= 0) return "Baseline";
  if (index <= 5) return "Level 1";
  if (index === 6) return "3 Month";
  if (index === 7) return "6 Month";
  if (index === 8) return "9 Month";
  if (index === 9) return "12 Month";
  if (index === 10) return "2.5 Year";
  if (index === 11) return "24 Month";
  if (index <= 13) return "3 Year";
  if (index === 14) return "36 Month";
  return "Complete";
}

export function deriveCurrentPhaseLabel(completedKeys: Set<string>): string {
  for (let i = 0; i < ADMIN_LOGICAL_CHECKLIST_STEPS.length; i++) {
    const step = ADMIN_LOGICAL_CHECKLIST_STEPS[i]!;
    if (!isLogicalStepComplete(step.templateKeys, completedKeys)) {
      return phaseLabelForStepIndex(i);
    }
  }
  return "Complete";
}

export function getNextIncompleteTemplateKey(completedKeys: Set<string>): string | null {
  for (const step of ADMIN_LOGICAL_CHECKLIST_STEPS) {
    for (const key of step.templateKeys) {
      if (!completedKeys.has(key)) return key;
    }
  }
  return null;
}

function isFollowUpKey(templateKey: string): boolean {
  return getFollowUpUnlockMonths(templateKey) != null;
}

/**
 * Last Adelaide calendar date on which the item is not overdue (overdue from the next day).
 * Follow-ups: unlock + FOLLOW_UP_GRACE_DAYS (3-year imaging: never).
 * Level 1: enrolment + getLevel1DueDays (template dueOffsetDays is not read).
 */
export function computeOverdueThreshold(params: {
  templateKey: string;
  enrollmentDate: Date | null | undefined;
  template: ChecklistTemplateMeta | undefined;
}): CivilDate | null {
  const { templateKey, enrollmentDate } = params;
  if (!enrollmentDate) return null;
  if (isFollowUpKey(templateKey)) {
    return getFollowUpOverdueThreshold(templateKey, enrollmentDate);
  }
  const dueDays = getLevel1DueDays(templateKey);
  if (dueDays == null) return null;
  return addCivilDays(adelaideCivilDate(enrollmentDate), dueDays);
}

export function isItemComputedOverdue(params: {
  templateKey: string;
  status: ChecklistStatus;
  enrollmentDate: Date | null | undefined;
  template: ChecklistTemplateMeta | undefined;
  now?: Date;
}): boolean {
  if (params.status === "COMPLETED") return false;
  const threshold = computeOverdueThreshold(params);
  if (!threshold) return false;
  const today = adelaideCivilDate(params.now ?? new Date());
  return compareCivilDates(today, threshold) > 0;
}

export type NextItemDate = {
  /** Level 1: due date. Follow-up: unlock date. */
  date: CivilDate;
  kind: "due" | "opens";
  overdueAfter: CivilDate | null;
};

export function computeNextItemDate(params: {
  templateKey: string;
  enrollmentDate: Date | null | undefined;
  template: ChecklistTemplateMeta | undefined;
}): NextItemDate | null {
  const { templateKey, enrollmentDate } = params;
  if (!enrollmentDate) return null;
  const unlock = getFollowUpUnlock(templateKey, enrollmentDate);
  if (unlock) {
    return {
      date: unlock.unlockDate,
      kind: "opens",
      overdueAfter: computeOverdueThreshold(params),
    };
  }
  const due = computeOverdueThreshold(params);
  return due ? { date: due, kind: "due", overdueAfter: due } : null;
}

export function buildDueDateDisplay(
  next: NextItemDate | null,
  now: Date = new Date()
): {
  label: string;
  tone: DueDateTone;
  daysLate: number | null;
} {
  if (!next) {
    return { label: "—", tone: "none", daysLate: null };
  }

  const today = adelaideCivilDate(now);
  const formatted = formatCivilDateDMY(next.date);
  const relation = compareCivilDates(next.date, today);
  const prefix = next.kind === "opens" ? (relation > 0 ? "Opens " : "Opened ") : "";

  if (next.overdueAfter && compareCivilDates(today, next.overdueAfter) > 0) {
    return {
      label: `${prefix}${formatted}`,
      tone: "overdue",
      daysLate: Math.max(1, civilDaysBetween(next.overdueAfter, today)),
    };
  }

  if (relation === 0) {
    return {
      label: next.kind === "opens" ? "Opens today" : "Today",
      tone: "today",
      daysLate: null,
    };
  }

  const weekday = civilWeekday(today);
  const weekEnd = addCivilDays(today, weekday === 0 ? 0 : 7 - weekday);
  if (relation > 0 && compareCivilDates(next.date, weekEnd) <= 0) {
    return { label: `${prefix}${formatted}`, tone: "this_week", daysLate: null };
  }

  return { label: `${prefix}${formatted}`, tone: "default", daysLate: null };
}

function hasAnyComputedOverdueItem(params: {
  completedKeys: Set<string>;
  enrollmentDate: Date | null | undefined;
  templatesByKey: Map<string, ChecklistTemplateMeta>;
  now?: Date;
}): boolean {
  for (const step of ADMIN_LOGICAL_CHECKLIST_STEPS) {
    for (const key of step.templateKeys) {
      if (params.completedKeys.has(key)) continue;
      if (
        isItemComputedOverdue({
          templateKey: key,
          status: "PENDING",
          enrollmentDate: params.enrollmentDate,
          template: params.templatesByKey.get(key),
          now: params.now,
        })
      ) {
        return true;
      }
    }
  }
  return false;
}

function deriveRowStatus(params: {
  isActive: boolean;
  completed: number;
  hasOverdueItems: boolean;
}): ParticipantProgressStatus {
  if (!params.isActive) return "withdrawn";
  if (params.completed >= ADMIN_CHECKLIST_STEP_TOTAL) return "completed";
  if (params.hasOverdueItems) return "overdue";
  return "on_track";
}

export function buildParticipantProgressRow(params: {
  id: string;
  name: string | null;
  email: string;
  studyRecordId: string | null;
  detailRecordId: string;
  isActive: boolean;
  enrollmentDate: Date | null | undefined;
  items: ChecklistItemInput[];
  templatesByKey: Map<string, ChecklistTemplateMeta>;
  now?: Date;
}): ParticipantProgressRow {
  const now = params.now ?? new Date();
  const progressItems: AdminChecklistProgressItem[] = params.items.map((item) => ({
    templateKey: item.templateKey,
    status: item.status,
  }));
  const progress = computeAdminChecklistProgress(progressItems);
  const completedKeys = new Set(
    params.items.filter((i) => i.status === "COMPLETED").map((i) => i.templateKey)
  );

  const currentPhase = deriveCurrentPhaseLabel(completedKeys);
  const nextTask = progress.currentStepName;
  const nextKey = getNextIncompleteTemplateKey(completedKeys);
  const nextDate = nextKey
    ? computeNextItemDate({
        templateKey: nextKey,
        enrollmentDate: params.enrollmentDate,
        template: params.templatesByKey.get(nextKey),
      })
    : null;
  const nextDueDate = nextDate ? adelaideMidnightUtc(nextDate.date) : null;
  const dueDisplay = buildDueDateDisplay(nextDate, now);
  const hasOverdueItems = hasAnyComputedOverdueItem({
    completedKeys,
    enrollmentDate: params.enrollmentDate,
    templatesByKey: params.templatesByKey,
    now,
  });
  const status = deriveRowStatus({
    isActive: params.isActive,
    completed: progress.completed,
    hasOverdueItems,
  });

  return {
    id: params.id,
    name: params.name?.trim() || params.email,
    email: params.email,
    studyRecordId: params.studyRecordId?.trim() || "—",
    detailRecordId: params.detailRecordId,
    isActive: params.isActive,
    completed: progress.completed,
    total: progress.total,
    currentPhase,
    nextTask,
    dueDateIso: nextDueDate?.toISOString() ?? null,
    dueDateLabel: dueDisplay.label,
    dueDateTone: dueDisplay.tone,
    daysLate: dueDisplay.daysLate,
    status,
    hasOverdueItems,
    sortOverdueRank: status === "overdue" ? 0 : 1,
    sortDueTimestamp: nextDueDate?.getTime() ?? Number.MAX_SAFE_INTEGER,
  };
}

export function computeParticipantProgressKpis(rows: ParticipantProgressRow[]): ParticipantProgressKpis {
  const participantCount = rows.length;
  let completedItems = 0;
  let inProgressCount = 0;
  let overdueCount = 0;

  for (const row of rows) {
    completedItems += row.completed;
    if (row.isActive && row.completed >= 1 && row.completed < ADMIN_CHECKLIST_STEP_TOTAL) {
      inProgressCount += 1;
    }
    if (row.hasOverdueItems) overdueCount += 1;
  }

  const totalItems = participantCount * ADMIN_CHECKLIST_STEP_TOTAL;
  const overallCompletionPct =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return {
    overallCompletionPct,
    completedItems,
    totalItems,
    inProgressCount,
    overdueCount,
    participantCount,
  };
}

export function sortParticipantProgressRows(
  rows: ParticipantProgressRow[]
): ParticipantProgressRow[] {
  return [...rows].sort((a, b) => {
    if (a.sortOverdueRank !== b.sortOverdueRank) {
      return a.sortOverdueRank - b.sortOverdueRank;
    }
    if (a.sortDueTimestamp !== b.sortDueTimestamp) {
      return a.sortDueTimestamp - b.sortDueTimestamp;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}
