/**
 * TEST ONLY — short intervals for manual QA of the school attendance diary reminder.
 * Before production, swap `ACTIVE_SCHOOL_ATTENDANCE_REMINDER_INTERVALS` to use
 * PRODUCTION_SCHOOL_ATTENDANCE_REMINDER_INTERVALS instead.
 */
export const REMINDER_TEST_INTERVALS = {
  /** Initial banner due this long after cycleStartAt */
  initialDueAfterMs: 1 * 60 * 1000,
  /** First follow-up due this long after initialDueAt (not cycle start) */
  firstFollowUpAfterInitialDueMs: 2 * 60 * 1000,
  /** Second follow-up due this long after firstFollowUpDueAt */
  secondFollowUpAfterFirstFollowUpMs: 1 * 60 * 1000,
} as const;

/** Production cadence (Fri 5pm / Sat 3pm / Sun 3pm Adelaide) — not wired yet. */
export const PRODUCTION_SCHOOL_ATTENDANCE_REMINDER_INTERVALS = {
  timezone: "Australia/Adelaide",
  initial: { weekday: 5, hour: 17, minute: 0 },
  firstFollowUp: { weekday: 6, hour: 15, minute: 0 },
  secondFollowUp: { weekday: 0, hour: 15, minute: 0 },
} as const;

export const ACTIVE_SCHOOL_ATTENDANCE_REMINDER_INTERVALS = REMINDER_TEST_INTERVALS;

export function computeReminderDueDates(cycleStartAt: Date): {
  initialDueAt: Date;
  firstFollowUpDueAt: Date;
  secondFollowUpDueAt: Date;
} {
  const intervals = ACTIVE_SCHOOL_ATTENDANCE_REMINDER_INTERVALS;
  const initialDueAt = new Date(
    cycleStartAt.getTime() + intervals.initialDueAfterMs
  );
  const firstFollowUpDueAt = new Date(
    initialDueAt.getTime() + intervals.firstFollowUpAfterInitialDueMs
  );
  const secondFollowUpDueAt = new Date(
    firstFollowUpDueAt.getTime() + intervals.secondFollowUpAfterFirstFollowUpMs
  );
  return { initialDueAt, firstFollowUpDueAt, secondFollowUpDueAt };
}
