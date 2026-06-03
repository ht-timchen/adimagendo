/** Level 1 template keys required for the early clinical block (matches study milestone). */
export const LEVEL_1_REQUIRED_TEMPLATE_KEYS = [
  "qol_baseline",
  "book_ultrasound",
  "book_mri",
  "book_bloods",
  "pre_tvus_survey",
  "ultrasound_completed",
  "post_tvus_survey",
  "confirm_blood_test",
  "confirm_mri",
] as const;

/** Coordinator monitoring window from REDCap enrolment (8 weeks). Not used to unlock TVUS steps. */
export const LEVEL_1_FOLLOW_UP_DUE_DAYS = 56;

/** Recommended Post-TVUS completion window after ultrasound marked complete. */
export const POST_TVUS_RECOMMENDED_DAYS_AFTER_ULTRASOUND = 7;
