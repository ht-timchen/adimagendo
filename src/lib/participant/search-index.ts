/**
 * Participant home search. Pure and client-safe: the only inputs are the static
 * page list below and the participant's own checklist item keys and titles.
 * Symptom, diary and appointment records are never part of the index.
 */

import {
  PARTICIPANT_APPOINTMENTS_PATH,
  PARTICIPANT_CHECKLIST_PATH,
  PARTICIPANT_DIARY_PATH,
  PARTICIPANT_HOME_PATH,
  PARTICIPANT_PROFILE_PATH,
  PARTICIPANT_SYMPTOMS_PATH,
} from "@/lib/participant-routes";

export type SearchEntryKind = "page" | "checklist";

export type SearchEntry = {
  id: string;
  kind: SearchEntryKind;
  label: string;
  href: string;
  keywords: readonly string[];
};

export type ChecklistSearchItem = { key: string; title: string };

const CHECKLIST_ANCHOR_PREFIX = "checklist-item-";

export function checklistItemAnchorId(key: string): string {
  return `${CHECKLIST_ANCHOR_PREFIX}${key}`;
}

export function isChecklistItemAnchorId(id: string): boolean {
  return /^checklist-item-[a-z0-9_]+$/.test(id);
}

export const PAGE_SEARCH_ENTRIES: readonly SearchEntry[] = [
  { id: "page-home", kind: "page", label: "Dashboard", href: PARTICIPANT_HOME_PATH, keywords: ["home", "overview", "progress"] },
  { id: "page-checklist", kind: "page", label: "Checklist", href: PARTICIPANT_CHECKLIST_PATH, keywords: ["tasks", "to do", "steps", "next step", "progress"] },
  { id: "page-appointments", kind: "page", label: "Appointments", href: PARTICIPANT_APPOINTMENTS_PATH, keywords: ["bookings", "booking", "schedule", "calendar", "visit"] },
  { id: "page-symptoms", kind: "page", label: "Symptom diary", href: PARTICIPANT_SYMPTOMS_PATH, keywords: ["symptoms", "pain", "period", "cramps", "log"] },
  { id: "page-diary", kind: "page", label: "Diary", href: PARTICIPANT_DIARY_PATH, keywords: ["school", "absence", "missed school", "work", "days off"] },
  { id: "page-profile", kind: "page", label: "Profile", href: PARTICIPANT_PROFILE_PATH, keywords: ["account", "my details", "details", "settings"] },
  { id: "page-documents", kind: "page", label: "Documents", href: "/dashboard/documents", keywords: ["files", "upload", "forms", "letters"] },
  { id: "page-contact", kind: "page", label: "Contact", href: "/dashboard/contact", keywords: ["help", "message", "study team", "question", "support", "email"] },
  { id: "page-news", kind: "page", label: "News", href: "/dashboard/news", keywords: ["updates", "announcements"] },
  { id: "page-notifications", kind: "page", label: "Notifications", href: "/dashboard/notifications", keywords: ["inbox", "messages", "alerts"] },
];

const ULTRASOUND = ["ultrasound", "scan", "tvus", "taus"] as const;
const BLOOD = ["blood", "bloods", "blood test", "pathology"] as const;
const MRI = ["mri", "scan"] as const;
const SURVEY = ["survey", "questionnaire", "qol", "quality of life"] as const;

/** Synonyms for every study checklist template key, in checklist order. */
export const CHECKLIST_SEARCH_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  qol_baseline: [...SURVEY, "baseline", "enrolment survey"],
  book_ultrasound: [...ULTRASOUND, "book", "booking"],
  book_mri: [...MRI, "book", "booking"],
  book_bloods: [...BLOOD, "book", "booking"],
  pre_tvus_survey: [...SURVEY, ...ULTRASOUND, "before"],
  ultrasound_completed: [...ULTRASOUND, "confirm", "done"],
  post_tvus_survey: [...SURVEY, ...ULTRASOUND, "after"],
  confirm_blood_test: [...BLOOD, "confirm", "done"],
  confirm_mri: [...MRI, "confirm", "done"],
  qol_3m: [...SURVEY, "3 month", "three month"],
  qol_6m: [...SURVEY, "6 month", "six month"],
  qol_9m: [...SURVEY, "9 month", "nine month"],
  qol_12m: [...SURVEY, "12 month", "1 year", "one year"],
  book_ultrasound_3y: [...ULTRASOUND, "book", "booking", "3 year", "2.5 year"],
  book_mri_3y: [...MRI, "book", "booking", "3 year", "2.5 year"],
  qol_24m: [...SURVEY, "24 month", "2 year", "two year"],
  ultrasound_3y_completed: [...ULTRASOUND, "confirm", "done", "3 year"],
  mri_3y_completed: [...MRI, "confirm", "done", "3 year"],
  qol_36m: [...SURVEY, "36 month", "3 year", "three year"],
};

const CHECKLIST_KEY_ORDER = Object.keys(CHECKLIST_SEARCH_SYNONYMS);

/** Page entries plus one entry per study checklist item the participant has. */
export function buildSearchIndex(checklistItems: readonly ChecklistSearchItem[]): SearchEntry[] {
  const byKey = new Map(checklistItems.map((item) => [item.key, item.title]));
  const checklistEntries: SearchEntry[] = CHECKLIST_KEY_ORDER.flatMap((key) => {
    const title = byKey.get(key)?.trim();
    if (!title) return [];
    return [
      {
        id: `checklist-${key}`,
        kind: "checklist" as const,
        label: title,
        href: `${PARTICIPANT_CHECKLIST_PATH}#${checklistItemAnchorId(key)}`,
        keywords: CHECKLIST_SEARCH_SYNONYMS[key],
      },
    ];
  });
  return [...PAGE_SEARCH_ENTRIES, ...checklistEntries];
}

export function normaliseSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    // Keeps decimals like "2.5"; no lookbehind, which older iOS Safari cannot parse.
    .replace(/(^|\D)\./g, "$1 ")
    .replace(/\.(?=\D|$)/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function words(text: string): string[] {
  const normalised = normaliseSearchText(text);
  return normalised ? normalised.split(" ") : [];
}

/** 0 = no match; higher ranks first. Every query word must prefix-match a word in the label or keywords. */
function scoreEntry(entry: SearchEntry, queryWords: string[], query: string): number {
  const labelText = normaliseSearchText(entry.label);
  const labelWords = labelText.split(" ");
  const keywordTexts = entry.keywords.map(normaliseSearchText);
  const allWords = [...labelWords, ...keywordTexts.flatMap((k) => k.split(" "))];
  if (!queryWords.every((q) => allWords.some((w) => w.startsWith(q)))) return 0;
  if (labelText.startsWith(query)) return 4;
  if (queryWords.every((q) => labelWords.some((w) => w.startsWith(q)))) return 3;
  if (keywordTexts.some((k) => k === query || k.startsWith(query))) return 2;
  return 1;
}

export const SEARCH_RESULT_LIMIT = 8;

export function searchEntries(
  index: readonly SearchEntry[],
  rawQuery: string,
  limit = SEARCH_RESULT_LIMIT
): SearchEntry[] {
  const query = normaliseSearchText(rawQuery);
  const queryWords = words(rawQuery);
  if (queryWords.length === 0) return [];
  return index
    .map((entry, position) => ({ entry, position, score: scoreEntry(entry, queryWords, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .slice(0, limit)
    .map((r) => r.entry);
}
