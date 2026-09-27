import { MISSING_ENROLLMENT_DATE_MESSAGE } from "@/lib/checklist/enrollment-date-for-timing";
import { computeUnlockAfterDays } from "@/lib/checklist/follow-up-availability";
import { getLevel1DueDays } from "@/lib/checklist/early-clinical-protocol";
import { LEVEL_1_FOLLOW_UP_DUE_DAYS } from "@/lib/checklist/protocol-timing";
import { adelaideCivilDate, compareCivilDates } from "@/lib/dates/adelaide-calendar";

/** Level 1 section due offset (enrolment + days). Follow-up Levels have no due date. */
export const LEVEL_1_SECTION_DUE_OFFSET_DAYS = LEVEL_1_FOLLOW_UP_DUE_DAYS;

/** Display-only due-by label from enrolment date + fixed day offset (Adelaide calendar date). */
export function getLevelDueLabel(params: {
  enrollmentDate: Date | null;
  dueOffsetDays: number;
  enrollmentDateMissing: boolean;
}): string | null {
  const { enrollmentDate, dueOffsetDays, enrollmentDateMissing } = params;
  if (dueOffsetDays <= 0) return null;
  if (enrollmentDateMissing || !enrollmentDate) {
    return MISSING_ENROLLMENT_DATE_MESSAGE;
  }
  return `Due by ${computeUnlockAfterDays(enrollmentDate, dueOffsetDays).label}`;
}

/** Participant wording once a Level 1 item is past its due date (never "overdue"). */
export const LEVEL_1_PAST_DUE_MESSAGE = "Please complete this as soon as you can.";

/** True from the Adelaide day after enrolment + dueOffsetDays. */
function isPastDue(enrollmentDate: Date, dueOffsetDays: number, now: Date): boolean {
  const dueDate = computeUnlockAfterDays(enrollmentDate, dueOffsetDays).unlockDate;
  return compareCivilDates(adelaideCivilDate(now), dueDate) > 0;
}

/**
 * Per-item "Due by" label for Level 1 items; null for other keys.
 * Participant view only: admin overdue flags come from participant-progress.ts.
 */
export function getLevel1EnrollmentDueLabel(params: {
  templateKey: string;
  enrollmentDate: Date | null;
  enrollmentDateMissing: boolean;
  now: Date;
}): string | null {
  const dueOffsetDays = getLevel1DueDays(params.templateKey);
  if (dueOffsetDays == null) return null;
  if (
    params.enrollmentDate &&
    !params.enrollmentDateMissing &&
    isPastDue(params.enrollmentDate, dueOffsetDays, params.now)
  ) {
    return LEVEL_1_PAST_DUE_MESSAGE;
  }
  return getLevelDueLabel({
    enrollmentDate: params.enrollmentDate,
    dueOffsetDays,
    enrollmentDateMissing: params.enrollmentDateMissing,
  });
}

/**
 * Level 1 summary text, e.g. "Level 1 · 4 of 9 · complete by 7 Nov 2026".
 * The date is dropped once it has passed or when the enrolment date is missing.
 */
export function getLevel1SummaryText(params: {
  completedCount: number;
  totalCount: number;
  enrollmentDate: Date | null;
  enrollmentDateMissing: boolean;
  now: Date;
}): string {
  const { completedCount, totalCount, enrollmentDate, enrollmentDateMissing, now } = params;
  if (completedCount >= totalCount) return "Level 1 · complete";
  const base = `Level 1 · ${completedCount} of ${totalCount}`;
  if (enrollmentDateMissing || !enrollmentDate) return base;
  if (isPastDue(enrollmentDate, LEVEL_1_FOLLOW_UP_DUE_DAYS, now)) return base;
  const completeBy = computeUnlockAfterDays(enrollmentDate, LEVEL_1_FOLLOW_UP_DUE_DAYS);
  return `${base} · complete by ${completeBy.label}`;
}
