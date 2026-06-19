import { MISSING_ENROLLMENT_DATE_MESSAGE } from "@/lib/checklist/enrollment-date-for-timing";

/** Section-level due offsets (enrollment + days). */
export const LEVEL_1_SECTION_DUE_OFFSET_DAYS = 56;
export const LEVEL_2_SECTION_DUE_OFFSET_DAYS = 365;
export const LEVEL_3_SECTION_DUE_OFFSET_DAYS = 1095;

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

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Display-only due-by label from enrollment date + fixed day offset. */
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
  const dueBy = addDays(enrollmentDate, dueOffsetDays);
  return `Due by ${formatDate(dueBy)}`;
}

/** Per-item due-by label; uses template dueOffsetDays when set. */
export function getLevel1EnrollmentDueLabel(params: {
  enrollmentDate: Date | null;
  dueOffsetDays: number | null | undefined;
  enrollmentDateMissing: boolean;
}): string | null {
  const { enrollmentDate, dueOffsetDays, enrollmentDateMissing } = params;
  if (dueOffsetDays == null || dueOffsetDays <= 0) return null;
  return getLevelDueLabel({
    enrollmentDate,
    dueOffsetDays,
    enrollmentDateMissing,
  });
}

/** Per-item due-by when dueOffsetDays may be absent (falls back to unlockOffsetDays). */
export function getTemplateEnrollmentDueLabel(params: {
  enrollmentDate: Date | null;
  dueOffsetDays?: number | null;
  unlockOffsetDays?: number | null;
  enrollmentDateMissing: boolean;
}): string | null {
  const offset =
    params.dueOffsetDays != null && params.dueOffsetDays > 0
      ? params.dueOffsetDays
      : params.unlockOffsetDays != null && params.unlockOffsetDays > 0
        ? params.unlockOffsetDays
        : null;
  if (offset == null) return null;
  return getLevelDueLabel({
    enrollmentDate: params.enrollmentDate,
    dueOffsetDays: offset,
    enrollmentDateMissing: params.enrollmentDateMissing,
  });
}
