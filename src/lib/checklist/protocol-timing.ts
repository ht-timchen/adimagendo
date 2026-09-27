/**
 * Study timing constants shared by prisma/seed.ts and the app.
 * Keep this module free of "@/..." imports so the seed can load it directly.
 */

/**
 * Follow-up items open on consent date + N calendar months (Adelaide calendar date).
 * REDCap closes surveys; the app has no closing date.
 */
export const FOLLOW_UP_UNLOCK_MONTHS = {
  qol_3m: 3,
  qol_6m: 6,
  qol_9m: 9,
  qol_12m: 12,
  qol_24m: 24,
  book_ultrasound_3y: 30,
  book_mri_3y: 30,
  qol_36m: 36,
  ultrasound_3y_completed: 36,
  mri_3y_completed: 36,
} as const satisfies Record<string, number>;

export type FollowUpTemplateKey = keyof typeof FOLLOW_UP_UNLOCK_MONTHS;

export const FOLLOW_UP_TEMPLATE_KEYS = Object.keys(
  FOLLOW_UP_UNLOCK_MONTHS
) as FollowUpTemplateKey[];

/** REDCap follow-up surveys; only these show a survey window to participants. */
export const FOLLOW_UP_SURVEY_TEMPLATE_KEYS = [
  "qol_3m",
  "qol_6m",
  "qol_9m",
  "qol_12m",
  "qol_24m",
  "qol_36m",
] as const;

/**
 * Internal coordinator follow-up threshold after a follow-up item opens (admin overdue).
 * Not shown to participants; kept separate from SURVEY_WINDOW_DAYS.
 * TEST VALUE: confirm with the research team before production.
 */
export const FOLLOW_UP_GRACE_DAYS = 30;

/**
 * Days a follow-up survey stays open in REDCap after it is released.
 * TEST VALUE: must match the REDCap survey window. Confirm with the REDCap data
 * manager before production.
 */
export const SURVEY_WINDOW_DAYS = 30;

/** While true, survey cards show that the window length is a test setting. Set false for launch. */
export const SURVEY_WINDOW_IS_TEST_VALUE = true;

/** Coordinator monitoring window for Level 1 from enrolment (8 weeks). */
export const LEVEL_1_FOLLOW_UP_DUE_DAYS = 56;

/** Baseline QoL survey due date from enrolment (PICF: "Enrolment · 1 week · Baseline Surveys"). */
export const BASELINE_DUE_DAYS = 7;

/**
 * Optional 3-year imaging items. Still visible, still required for Level 3,
 * but excluded from admin overdue until the research team confirms when they apply.
 */
export const THREE_YEAR_IMAGING_TEMPLATE_KEYS = [
  "book_ultrasound_3y",
  "book_mri_3y",
  "ultrasound_3y_completed",
  "mri_3y_completed",
] as const;

export function getFollowUpUnlockMonths(templateKey: string): number | null {
  return Object.prototype.hasOwnProperty.call(FOLLOW_UP_UNLOCK_MONTHS, templateKey)
    ? FOLLOW_UP_UNLOCK_MONTHS[templateKey as FollowUpTemplateKey]
    : null;
}

export function isFollowUpSurveyTemplateKey(templateKey: string): boolean {
  return (FOLLOW_UP_SURVEY_TEMPLATE_KEYS as readonly string[]).includes(templateKey);
}

export function isThreeYearImagingTemplateKey(templateKey: string): boolean {
  return (THREE_YEAR_IMAGING_TEMPLATE_KEYS as readonly string[]).includes(templateKey);
}
