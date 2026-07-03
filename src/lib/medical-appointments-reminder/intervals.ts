/**
 * Medical appointments reminder timing configuration.
 */
import { getLastDayOfMonth } from "./month-boundary";

/** Production cadence (last day of month 5pm / +1d 5pm / +2d 5pm Adelaide). */
export const PRODUCTION_MEDICAL_APPOINTMENTS_REMINDER_INTERVALS = {
  timezone: "Australia/Adelaide",
  initial: { hour: 17, minute: 0 },
  firstFollowUpOffsetDays: 1,
  secondFollowUpOffsetDays: 2,
} as const;

export const ACTIVE_MEDICAL_APPOINTMENTS_REMINDER_INTERVALS =
  PRODUCTION_MEDICAL_APPOINTMENTS_REMINDER_INTERVALS;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

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
  config: typeof PRODUCTION_MEDICAL_APPOINTMENTS_REMINDER_INTERVALS
): {
  initialDueAt: Date;
  firstFollowUpDueAt: Date;
  secondFollowUpDueAt: Date;
} {
  const { timezone } = config;
  const zoned = getZonedParts(cycleStartAt, timezone);
  const lastDay = getLastDayOfMonth(zoned.year, zoned.month);
  const monthEnd = {
    year: zoned.year,
    month: zoned.month,
    day: lastDay,
  };

  const firstFollowUp = addCalendarDays(
    monthEnd.year,
    monthEnd.month,
    monthEnd.day,
    config.firstFollowUpOffsetDays
  );
  const secondFollowUp = addCalendarDays(
    monthEnd.year,
    monthEnd.month,
    monthEnd.day,
    config.secondFollowUpOffsetDays
  );

  return {
    initialDueAt: zonedWallClockToUtc(timezone, {
      ...monthEnd,
      hour: config.initial.hour,
      minute: config.initial.minute,
    }),
    firstFollowUpDueAt: zonedWallClockToUtc(timezone, {
      ...firstFollowUp,
      hour: config.initial.hour,
      minute: config.initial.minute,
    }),
    secondFollowUpDueAt: zonedWallClockToUtc(timezone, {
      ...secondFollowUp,
      hour: config.initial.hour,
      minute: config.initial.minute,
    }),
  };
}

export function computeReminderDueDates(cycleStartAt: Date): {
  initialDueAt: Date;
  firstFollowUpDueAt: Date;
  secondFollowUpDueAt: Date;
} {
  return computeProductionReminderDueDates(
    cycleStartAt,
    ACTIVE_MEDICAL_APPOINTMENTS_REMINDER_INTERVALS
  );
}
