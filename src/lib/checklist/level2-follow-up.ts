/** Level 2 template keys (matches study milestone level_2_complete in seed). */
export const LEVEL_2_REQUIRED_TEMPLATE_KEYS = [
  "qol_3m",
  "qol_6m",
  "qol_9m",
  "qol_12m",
] as const;

/** Level 3 template keys (matches study milestone long_term_complete in seed). */
export const LEVEL_3_REQUIRED_TEMPLATE_KEYS = [
  "book_ultrasound_3y",
  "book_mri_3y",
  "qol_24m",
  "ultrasound_3y_completed",
  "mri_3y_completed",
  "qol_36m",
] as const;

export function isLevel2Complete(completedTemplateKeys: Set<string>): boolean {
  return LEVEL_2_REQUIRED_TEMPLATE_KEYS.every((key) =>
    completedTemplateKeys.has(key)
  );
}

export function isLevel3Complete(completedTemplateKeys: Set<string>): boolean {
  return LEVEL_3_REQUIRED_TEMPLATE_KEYS.every((key) =>
    completedTemplateKeys.has(key)
  );
}
