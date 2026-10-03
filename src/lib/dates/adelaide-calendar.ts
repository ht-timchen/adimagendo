/**
 * Adelaide calendar-date helpers. Results do not depend on the server time zone.
 */

export const ADELAIDE_TIME_ZONE = "Australia/Adelaide";

/** Calendar date; month is 1–12. */
export type CivilDate = { year: number; month: number; day: number };

const civilDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ADELAIDE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const wallClockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ADELAIDE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Fixed "MMM" names; en-AU Intl uses "June", "July" and "Sept". */
const MONTH_ABBREVIATIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  return Number(parts.find((part) => part.type === type)?.value ?? "0");
}

export function adelaideCivilDate(instant: Date): CivilDate {
  const parts = civilDateFormatter.formatToParts(instant);
  return {
    year: readPart(parts, "year"),
    month: readPart(parts, "month"),
    day: readPart(parts, "day"),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Adds calendar months; the day is clamped to the target month's length (31 Jan + 1 → 28/29 Feb). */
export function addCalendarMonths(date: CivilDate, months: number): CivilDate {
  const monthIndex = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex - year * 12 + 1;
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

export function addCivilDays(date: CivilDate, days: number): CivilDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function compareCivilDates(a: CivilDate, b: CivilDate): number {
  return (
    Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)
  );
}

export function civilDaysBetween(from: CivilDate, to: CivilDate): number {
  return Math.round(compareCivilDates(to, from) / (24 * 60 * 60 * 1000));
}

/** 0 = Sunday … 6 = Saturday. */
export function civilWeekday(date: CivilDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function adelaideOffsetMs(instantMs: number): number {
  const parts = wallClockFormatter.formatToParts(new Date(instantMs));
  const wallAsUtc = Date.UTC(
    readPart(parts, "year"),
    readPart(parts, "month") - 1,
    readPart(parts, "day"),
    readPart(parts, "hour"),
    readPart(parts, "minute"),
    readPart(parts, "second")
  );
  return wallAsUtc - Math.floor(instantMs / 1000) * 1000;
}

/** The instant of the given Adelaide wall-clock time on the given calendar date. */
export function adelaideWallClockToUtc(
  date: CivilDate,
  hour: number,
  minute = 0,
  second = 0
): Date {
  const wallMs = Date.UTC(date.year, date.month - 1, date.day, hour, minute, second);
  let instant = wallMs - adelaideOffsetMs(wallMs);
  const corrected = wallMs - adelaideOffsetMs(instant);
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
}

function adelaideWallTimeUtc(date: CivilDate, hour: number): Date {
  return adelaideWallClockToUtc(date, hour);
}

/** The instant of 00:00 Adelaide time on the given calendar date. */
export function adelaideMidnightUtc(date: CivilDate): Date {
  return adelaideWallTimeUtc(date, 0);
}

/**
 * The instant of 12:00 Adelaide time on the given calendar date. Used to store
 * date-only values: it falls on the same calendar day in UTC and in Adelaide.
 */
export function adelaideNoonUtc(date: CivilDate): Date {
  return adelaideWallTimeUtc(date, 12);
}

/** Parses a strict "YYYY-MM-DD" calendar date; null if malformed or not a real date. */
export function parseCivilDateYmd(value: string): CivilDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** "YYYY-MM-DD", e.g. for `<input type="date">` values. */
export function formatCivilDateYmd(date: CivilDate): string {
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${String(date.year).padStart(4, "0")}-${month}-${day}`;
}

/** "d MMM yyyy" (en-AU day-month order), e.g. "1 Jul 2026". */
export function formatAdelaideCivilDate(date: CivilDate): string {
  return `${date.day} ${MONTH_ABBREVIATIONS[date.month - 1]} ${date.year}`;
}

/** dd/mm/yyyy for admin tables. */
export function formatCivilDateDMY(date: CivilDate): string {
  const day = String(date.day).padStart(2, "0");
  const month = String(date.month).padStart(2, "0");
  return `${day}/${month}/${date.year}`;
}
