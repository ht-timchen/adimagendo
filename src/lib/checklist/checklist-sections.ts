import {
  SURVEY_WINDOW_DAYS_LEFT_THRESHOLD,
  type SurveyWindowState,
} from "@/lib/checklist/follow-up-availability";

/**
 * Display-only grouping of participant checklist cards. Availability, prerequisites
 * and completion are computed elsewhere and passed in; this module never changes them.
 */

export const TODO_INITIAL_VISIBLE_CARDS = 3;
export const COMING_UP_MAX_CARDS = 2;

export type ChecklistTimeGate =
  | { kind: "open" }
  | { kind: "opens_later"; opensAt: Date }
  | { kind: "enrollment_date_missing" };

/** One rendered card: a single template, or a whole booking group. */
export type ChecklistCardEntry = {
  /** Template key, or booking group key for a booking group card. */
  key: string;
  title: string;
  /** Position in the Level/sortOrder page order. */
  order: number;
  completed: boolean;
  timeGate: ChecklistTimeGate;
  prerequisitesMet: boolean;
  surveyWindow: { state: SurveyWindowState; daysLeft: number | null } | null;
};

export type ChecklistSectionKey = "todo" | "comingUp" | "waiting" | "later" | "completed";

/** Due dates are shown only on cards the participant can act on now. */
export function showsDueDate(section: ChecklistSectionKey | undefined): boolean {
  return section === "todo";
}

export type ChecklistSections<E extends ChecklistCardEntry = ChecklistCardEntry> = {
  /** Section of every card, keyed by card key. */
  sectionOf: Map<string, ChecklistSectionKey>;
  todo: E[];
  todoVisible: E[];
  todoHidden: E[];
  /** Hidden to-do cards whose survey window closes within the days-left threshold. */
  todoHiddenClosingSoon: E[];
  comingUp: E[];
  waiting: E[];
  later: E[];
  completed: E[];
};

export function isSurveyClosingSoon(entry: ChecklistCardEntry): boolean {
  const w = entry.surveyWindow;
  if (!w) return false;
  if (w.state === "last_day") return true;
  return (
    w.state === "open" &&
    w.daysLeft != null &&
    w.daysLeft <= SURVEY_WINDOW_DAYS_LEFT_THRESHOLD
  );
}

function todoRank(entry: ChecklistCardEntry): number {
  if (isSurveyClosingSoon(entry)) return 0;
  if (entry.surveyWindow?.state === "closed") return 2;
  return 1;
}

function compareTodo(a: ChecklistCardEntry, b: ChecklistCardEntry): number {
  const rank = todoRank(a) - todoRank(b);
  if (rank !== 0) return rank;
  if (todoRank(a) === 0) {
    const diff = (a.surveyWindow?.daysLeft ?? 0) - (b.surveyWindow?.daysLeft ?? 0);
    if (diff !== 0) return diff;
  }
  return a.order - b.order;
}

function opensAtMs(entry: ChecklistCardEntry): number {
  return entry.timeGate.kind === "opens_later"
    ? entry.timeGate.opensAt.getTime()
    : Number.POSITIVE_INFINITY;
}

function compareFuture(a: ChecklistCardEntry, b: ChecklistCardEntry): number {
  const am = opensAtMs(a);
  const bm = opensAtMs(b);
  if (am !== bm) return am < bm ? -1 : 1;
  return a.order - b.order;
}

/**
 * One slot per rendered card, in Level then template order. Templates sharing a
 * booking group collapse into the first template of that group.
 */
export function collectChecklistCardSlots<
  L extends { templates: readonly { completionGroupKey: string | null }[] },
>(
  levels: readonly L[],
  isBookingGroupKey: (key: string | null) => boolean
): { template: L["templates"][number]; level: L }[] {
  const slots: { template: L["templates"][number]; level: L }[] = [];
  const seenGroups = new Set<string>();
  for (const level of levels) {
    for (const template of level.templates) {
      const groupKey = template.completionGroupKey;
      if (groupKey != null && isBookingGroupKey(groupKey)) {
        if (seenGroups.has(groupKey)) continue;
        seenGroups.add(groupKey);
      }
      slots.push({ template, level });
    }
  }
  return slots;
}

/** First matching rule wins, so every card lands in exactly one section. */
export function classifyChecklistCard(
  entry: ChecklistCardEntry
): "todo" | "future" | "waiting" | "completed" {
  if (entry.completed) return "completed";
  if (entry.timeGate.kind !== "open") return "future";
  if (!entry.prerequisitesMet) return "waiting";
  return "todo";
}

export function groupChecklistCards<E extends ChecklistCardEntry>(
  entries: readonly E[]
): ChecklistSections<E> {
  const todo: E[] = [];
  const future: E[] = [];
  const waiting: E[] = [];
  const completed: E[] = [];

  for (const entry of entries) {
    switch (classifyChecklistCard(entry)) {
      case "completed":
        completed.push(entry);
        break;
      case "future":
        future.push(entry);
        break;
      case "waiting":
        waiting.push(entry);
        break;
      case "todo":
        todo.push(entry);
        break;
    }
  }

  todo.sort(compareTodo);
  future.sort(compareFuture);
  waiting.sort((a, b) => a.order - b.order);
  completed.sort((a, b) => a.order - b.order);

  const comingUp = future
    .filter((e) => e.timeGate.kind === "opens_later")
    .slice(0, COMING_UP_MAX_CARDS);
  const comingUpKeys = new Set(comingUp.map((e) => e.key));
  const later = future.filter((e) => !comingUpKeys.has(e.key));

  const todoVisible = todo.slice(0, TODO_INITIAL_VISIBLE_CARDS);
  const todoHidden = todo.slice(TODO_INITIAL_VISIBLE_CARDS);

  const sectionOf = new Map<string, ChecklistSectionKey>();
  const bySection: [ChecklistSectionKey, E[]][] = [
    ["todo", todo],
    ["comingUp", comingUp],
    ["waiting", waiting],
    ["later", later],
    ["completed", completed],
  ];
  for (const [section, list] of bySection) {
    for (const e of list) sectionOf.set(e.key, section);
  }

  return {
    sectionOf,
    todo,
    todoVisible,
    todoHidden,
    todoHiddenClosingSoon: todoHidden.filter(isSurveyClosingSoon),
    comingUp,
    waiting,
    later,
    completed,
  };
}

/** Short participant text for the "Also closing soon" summary. */
export function closingSoonSummaryText(entry: ChecklistCardEntry): string {
  const w = entry.surveyWindow;
  if (w?.state === "last_day") return `${entry.title} · last day today`;
  return `${entry.title} · ${w?.daysLeft ?? 0} days left`;
}
