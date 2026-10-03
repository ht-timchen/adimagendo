import { adelaideCivilDate } from "@/lib/dates/adelaide-calendar";

/**
 * Age in whole years on the Adelaide calendar day of `reference`.
 *
 * `dob` is a date-only value stored as UTC midnight (see parseRedcapDob), so its
 * calendar parts are read in UTC. `reference` is a real instant (e.g. a consent
 * signature time), so its calendar day is taken in Adelaide, not in the server's
 * timezone: an 08:00 Adelaide signature is the previous day in UTC.
 */
export function ageAtDate(dob: Date, reference: Date): number {
  const today = adelaideCivilDate(reference);
  const dobMonth = dob.getUTCMonth() + 1;
  const dobDay = dob.getUTCDate();
  let age = today.year - dob.getUTCFullYear();
  if (today.month < dobMonth || (today.month === dobMonth && today.day < dobDay)) {
    age -= 1;
  }
  return age;
}
