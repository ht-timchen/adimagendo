import { adelaideWallClockToUtc } from "@/lib/dates/adelaide-calendar";

const REDCAP_DATETIME = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * REDCap datetimes (e.g. consent signature times) are Adelaide wall-clock times
 * exported without an offset. Parse them explicitly as Adelaide so the result
 * does not depend on the server's TZ. A date-only value means Adelaide midnight.
 * Returns null for empty, malformed, or impossible values.
 */
export function parseRedcapDate(val: string): Date | null {
  if (!val || val.trim() === "") return null;
  const m = REDCAP_DATETIME.exec(val.trim());
  if (!m) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0"] = m;
  const year = +y;
  const month = +mo;
  const day = +d;
  const hour = +h;
  const minute = +mi;
  const second = +s;

  // Reject impossible values (month 13, 31 Feb, 25:00) instead of letting them roll over.
  const check = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  return adelaideWallClockToUtc({ year, month, day }, hour, minute, second);
}

/**
 * REDCap date of birth is a date-only value ("YYYY-MM-DD"), which JavaScript
 * parses as UTC midnight regardless of server TZ. Kept separate from
 * parseRedcapDate on purpose: converting DoB as Adelaide midnight would land on
 * the previous UTC day and break the DoB comparison at enrolment.
 */
export function parseRedcapDob(val: string): Date | null {
  if (!val || val.trim() === "") return null;
  const d = new Date(val.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}
