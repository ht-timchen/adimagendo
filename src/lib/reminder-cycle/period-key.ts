const ADELAIDE = "Australia/Adelaide";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function adelaideCivilDate(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ADELAIDE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { year: read("year"), month: read("month"), day: read("day") };
}

/** Adelaide-local Friday of R1, e.g. school:2026-06-05. */
export function schoolPeriodKey(reminder1At: Date): string {
  const { year, month, day } = adelaideCivilDate(reminder1At);
  return `school:${year}-${pad(month)}-${pad(day)}`;
}

/** Adelaide-local month of R1, e.g. medical:2026-06. */
export function medicalPeriodKey(reminder1At: Date): string {
  const { year, month } = adelaideCivilDate(reminder1At);
  return `medical:${year}-${pad(month)}`;
}
