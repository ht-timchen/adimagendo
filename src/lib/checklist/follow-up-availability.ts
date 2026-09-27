import {
  addCalendarMonths,
  addCivilDays,
  adelaideCivilDate,
  adelaideMidnightUtc,
  civilDaysBetween,
  compareCivilDates,
  formatAdelaideCivilDate,
  type CivilDate,
} from "@/lib/dates/adelaide-calendar";
import {
  FOLLOW_UP_GRACE_DAYS,
  getFollowUpUnlockMonths,
  isFollowUpSurveyTemplateKey,
  isThreeYearImagingTemplateKey,
  SURVEY_WINDOW_DAYS,
  SURVEY_WINDOW_IS_TEST_VALUE,
} from "./protocol-timing";

export const FOLLOW_UP_ENROLLMENT_MISSING_TEXT =
  "Available once your enrolment date is confirmed";

export type FollowUpUnlock = {
  unlockDate: CivilDate;
  unlocksAt: Date;
  label: string;
};

export function computeUnlockAfterMonths(
  enrollmentDate: Date,
  months: number
): FollowUpUnlock {
  const unlockDate = addCalendarMonths(adelaideCivilDate(enrollmentDate), months);
  return {
    unlockDate,
    unlocksAt: adelaideMidnightUtc(unlockDate),
    label: formatAdelaideCivilDate(unlockDate),
  };
}

export function computeUnlockAfterDays(
  enrollmentDate: Date,
  days: number
): FollowUpUnlock {
  const unlockDate = addCivilDays(adelaideCivilDate(enrollmentDate), days);
  return {
    unlockDate,
    unlocksAt: adelaideMidnightUtc(unlockDate),
    label: formatAdelaideCivilDate(unlockDate),
  };
}

/** Unlock date for a follow-up template key, or null when the key is not month-timed. */
export function getFollowUpUnlock(
  templateKey: string,
  enrollmentDate: Date
): FollowUpUnlock | null {
  const months = getFollowUpUnlockMonths(templateKey);
  if (months == null) return null;
  return computeUnlockAfterMonths(enrollmentDate, months);
}

export function followUpAvailableFromText(unlock: FollowUpUnlock): string {
  return `Available from ${unlock.label}`;
}

export type SurveyWindowState = "upcoming" | "open" | "last_day" | "closed";

export type SurveyWindow = {
  state: SurveyWindowState;
  opensDate: CivilDate;
  /** Last full day the survey is open: unlock date + SURVEY_WINDOW_DAYS - 1. */
  lastDate: CivilDate;
  lastDateLabel: string;
  /** Days left including today while open; null otherwise. */
  daysLeft: number | null;
  /** Participant text; for "closed" the UI appends the contact sentence. */
  text: string;
};

/** Days-left count is shown only at or below this many days. */
export const SURVEY_WINDOW_DAYS_LEFT_THRESHOLD = 7;

/**
 * Participant-facing survey window for follow-up surveys (qol_3m … qol_36m).
 * Display only: the app does not close surveys.
 */
export function getSurveyWindow(
  templateKey: string,
  enrollmentDate: Date,
  now: Date,
  windowDays: number = SURVEY_WINDOW_DAYS
): SurveyWindow | null {
  if (!isFollowUpSurveyTemplateKey(templateKey)) return null;
  const unlock = getFollowUpUnlock(templateKey, enrollmentDate);
  if (!unlock) return null;

  const lastDate = addCivilDays(unlock.unlockDate, windowDays - 1);
  const lastDateLabel = formatAdelaideCivilDate(lastDate);
  const today = adelaideCivilDate(now);
  const base = { opensDate: unlock.unlockDate, lastDate, lastDateLabel };

  if (compareCivilDates(today, unlock.unlockDate) < 0) {
    return {
      ...base,
      state: "upcoming",
      daysLeft: null,
      text: `${followUpAvailableFromText(unlock)} · open for ${windowDays} days`,
    };
  }

  if (compareCivilDates(today, lastDate) > 0) {
    return {
      ...base,
      state: "closed",
      daysLeft: null,
      text: `This survey closed on ${lastDateLabel}.`,
    };
  }

  const daysLeft = civilDaysBetween(today, lastDate) + 1;
  if (daysLeft === 1) {
    return {
      ...base,
      state: "last_day",
      daysLeft,
      text: `Last day to complete: today (${lastDateLabel})`,
    };
  }

  return {
    ...base,
    state: "open",
    daysLeft,
    text:
      daysLeft <= SURVEY_WINDOW_DAYS_LEFT_THRESHOLD
        ? `Open until ${lastDateLabel} · ${daysLeft} days left`
        : `Open until ${lastDateLabel}`,
  };
}

export const SURVEY_WINDOW_CLOSED_CONTACT_PREFIX = "If you missed it, please";
export const SURVEY_WINDOW_CLOSED_CONTACT_LINK_TEXT = "contact the study team";

/** Extra line while the window length is a test setting; null when the flag is off. */
export function surveyWindowTestLabel(
  isTestValue: boolean = SURVEY_WINDOW_IS_TEST_VALUE,
  windowDays: number = SURVEY_WINDOW_DAYS
): string | null {
  if (!isTestValue) return null;
  return `Test setting: the ${windowDays}-day window may change before launch.`;
}

/**
 * Last Adelaide calendar date on which a follow-up item is not yet overdue.
 * Overdue from the next day. Null for non-follow-up keys and 3-year imaging.
 */
export function getFollowUpOverdueThreshold(
  templateKey: string,
  enrollmentDate: Date
): CivilDate | null {
  if (isThreeYearImagingTemplateKey(templateKey)) return null;
  const unlock = getFollowUpUnlock(templateKey, enrollmentDate);
  if (!unlock) return null;
  return addCivilDays(unlock.unlockDate, FOLLOW_UP_GRACE_DAYS);
}
