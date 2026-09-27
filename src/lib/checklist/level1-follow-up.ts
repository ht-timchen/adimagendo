import {
  addCivilDays,
  adelaideCivilDate,
  compareCivilDates,
} from "@/lib/dates/adelaide-calendar";
import { LEVEL_1_REQUIRED_TEMPLATE_KEYS } from "./early-clinical-protocol";
import { LEVEL_1_FOLLOW_UP_DUE_DAYS } from "./protocol-timing";

export function isLevel1Complete(completedTemplateKeys: Set<string>): boolean {
  return LEVEL_1_REQUIRED_TEMPLATE_KEYS.every((key) =>
    completedTemplateKeys.has(key)
  );
}

/**
 * Display-only coordinator signal: Level 1 still incomplete after the 8-week window.
 * Does not set checklist OVERDUE or change unlock rules.
 */
export function isLevel1FollowUpDue(params: {
  enrollmentDate: Date;
  completedTemplateKeys: Set<string>;
  now?: Date;
}): boolean {
  const { enrollmentDate, completedTemplateKeys, now = new Date() } = params;
  if (isLevel1Complete(completedTemplateKeys)) return false;

  const threshold = addCivilDays(
    adelaideCivilDate(enrollmentDate),
    LEVEL_1_FOLLOW_UP_DUE_DAYS
  );
  return compareCivilDates(adelaideCivilDate(now), threshold) > 0;
}

export const LEVEL_1_FOLLOW_UP_LABEL =
  "Level 1 follow-up due (early clinical block incomplete after 8-week window)";
