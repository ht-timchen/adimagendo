import type { ChecklistStatus } from "@prisma/client";
import {
  ADMIN_CHECKLIST_STEP_TOTAL,
  ADMIN_LOGICAL_CHECKLIST_STEPS,
  computeAdminChecklistProgress,
  type AdminChecklistProgressItem,
} from "@/lib/admin/checklist-progress";

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

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(base: Date, days: number): Date {
  const d = startOfDay(base);
  d.setDate(d.getDate() + days);
  return d;
}

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

function resolveDueOffsetDays(template: ChecklistTemplateMeta | undefined): number | null {
  if (!template?.dueOffsetDays || template.dueOffsetDays <= 0) return null;
  return template.dueOffsetDays;
}

export function computeItemDueDate(
  enrollmentDate: Date | null | undefined,
  dueOffsetDays: number | null
): Date | null {
  if (!enrollmentDate || dueOffsetDays == null || dueOffsetDays <= 0) return null;
  return addDays(enrollmentDate, dueOffsetDays);
}

export function isItemComputedOverdue(params: {
  status: ChecklistStatus;
  enrollmentDate: Date | null | undefined;
  dueOffsetDays: number | null;
  now?: Date;
}): boolean {
  if (params.status === "COMPLETED") return false;
  const dueDate = computeItemDueDate(params.enrollmentDate, params.dueOffsetDays);
  if (!dueDate) return false;
  const today = startOfDay(params.now ?? new Date());
  return dueDate < today;
}

function endOfWeekSunday(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  return addDays(d, daysUntilSunday);
}

export function formatDueDateDMY(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function buildDueDateDisplay(
  dueDate: Date | null,
  now: Date = new Date()
): {
  label: string;
  tone: DueDateTone;
  daysLate: number | null;
} {
  if (!dueDate) {
    return { label: "—", tone: "none", daysLate: null };
  }

  const today = startOfDay(now);
  const due = startOfDay(dueDate);
  const formatted = formatDueDateDMY(due);

  if (due < today) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysLate = Math.max(1, Math.round((today.getTime() - due.getTime()) / msPerDay));
    return {
      label: formatted,
      tone: "overdue",
      daysLate,
    };
  }

  if (due.getTime() === today.getTime()) {
    return { label: "Today", tone: "today", daysLate: null };
  }

  const weekEnd = endOfWeekSunday(today);
  if (due <= weekEnd) {
    return { label: formatted, tone: "this_week", daysLate: null };
  }

  return { label: formatted, tone: "default", daysLate: null };
}

function hasAnyComputedOverdueItem(params: {
  items: ChecklistItemInput[];
  enrollmentDate: Date | null | undefined;
  templatesByKey: Map<string, ChecklistTemplateMeta>;
  now?: Date;
}): boolean {
  for (const item of params.items) {
    const template = params.templatesByKey.get(item.templateKey);
    const dueOffsetDays = resolveDueOffsetDays(template);
    if (
      isItemComputedOverdue({
        status: item.status,
        enrollmentDate: params.enrollmentDate,
        dueOffsetDays,
        now: params.now,
      })
    ) {
      return true;
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
  const nextTemplate = nextKey ? params.templatesByKey.get(nextKey) : undefined;
  const nextDueDate = computeItemDueDate(
    params.enrollmentDate,
    resolveDueOffsetDays(nextTemplate)
  );
  const dueDisplay = buildDueDateDisplay(nextDueDate, now);
  const hasOverdueItems = hasAnyComputedOverdueItem({
    items: params.items,
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
