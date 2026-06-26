/**
 * School attendance reminder timing configuration.
 */
/** TEST ONLY — short ms offsets for manual QA (not active). */
export const REMINDER_TEST_INTERVALS = {
  /** Initial banner due this long after cycleStartAt */
  initialDueAfterMs: 1 * 60 * 1000,
  /** First follow-up due this long after initialDueAt (not cycle start) */
  firstFollowUpAfterInitialDueMs: 2 * 60 * 1000,
  /** Second follow-up due this long after firstFollowUpDueAt */
  secondFollowUpAfterFirstFollowUpMs: 1 * 60 * 1000,
} as const;

/** Production cadence (Fri 5pm / Sat 3pm / Sun 3pm Adelaide). */
export const PRODUCTION_SCHOOL_ATTENDANCE_REMINDER_INTERVALS = {
  timezone: "Australia/Adelaide",
  initial: { weekday: 5, hour: 17, minute: 0 },
  firstFollowUp: { weekday: 6, hour: 15, minute: 0 },
  secondFollowUp: { weekday: 0, hour: 15, minute: 0 },
} as const;

export const ACTIVE_SCHOOL_ATTENDANCE_REMINDER_INTERVALS =
  PRODUCTION_SCHOOL_ATTENDANCE_REMINDER_INTERVALS;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const ADELAIDE_WEEKDAY_OFFSET: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function isTestIntervals(
  intervals: typeof REMINDER_TEST_INTERVALS | typeof PRODUCTION_SCHOOL_ATTENDANCE_REMINDER_INTERVALS
): intervals is typeof REMINDER_TEST_INTERVALS {
  return "initialDueAfterMs" in intervals;
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function getZonedWeekdayShort(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  days: number
): Pick<ZonedParts, "year" | "month" | "day"> {
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function zonedWallClockToUtc(
  timeZone: string,
  target: Pick<ZonedParts, "year" | "month" | "day" | "hour" | "minute">
): Date {
  const wantMs = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    0
  );

  let low = wantMs - 48 * 60 * 60 * 1000;
  let high = wantMs + 48 * 60 * 60 * 1000;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const zoned = getZonedParts(new Date(mid), timeZone);
    const zonedMs = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second
    );

    if (zonedMs < wantMs) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return new Date(low);
}

function computeProductionReminderDueDates(
  cycleStartAt: Date,
  config: typeof PRODUCTION_SCHOOL_ATTENDANCE_REMINDER_INTERVALS
): {
  initialDueAt: Date;
  firstFollowUpDueAt: Date;
  secondFollowUpDueAt: Date;
} {
  const { timezone } = config;
  const zoned = getZonedParts(cycleStartAt, timezone);
  const weekday = getZonedWeekdayShort(cycleStartAt, timezone);
  const monday = addCalendarDays(
    zoned.year,
    zoned.month,
    zoned.day,
    -(ADELAIDE_WEEKDAY_OFFSET[weekday] ?? 0)
  );

  const friday = addCalendarDays(monday.year, monday.month, monday.day, 4);
  const saturday = addCalendarDays(monday.year, monday.month, monday.day, 5);
  const sunday = addCalendarDays(monday.year, monday.month, monday.day, 6);

  return {
    initialDueAt: zonedWallClockToUtc(timezone, {
      ...friday,
      hour: config.initial.hour,
      minute: config.initial.minute,
    }),
    firstFollowUpDueAt: zonedWallClockToUtc(timezone, {
      ...saturday,
      hour: config.firstFollowUp.hour,
      minute: config.firstFollowUp.minute,
    }),
    secondFollowUpDueAt: zonedWallClockToUtc(timezone, {
      ...sunday,
      hour: config.secondFollowUp.hour,
      minute: config.secondFollowUp.minute,
    }),
  };
}

export function computeReminderDueDates(cycleStartAt: Date): {
  initialDueAt: Date;
  firstFollowUpDueAt: Date;
  secondFollowUpDueAt: Date;
} {
  const intervals = ACTIVE_SCHOOL_ATTENDANCE_REMINDER_INTERVALS;

  if (!isTestIntervals(intervals)) {
    return computeProductionReminderDueDates(cycleStartAt, intervals);
  }

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
