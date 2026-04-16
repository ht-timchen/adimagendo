/** Calendar `min` for date inputs: tomorrow (local), for first-time booking flows. */
export function tomorrowYmdLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calendar `min` for rescheduling: today (local). */
export function todayYmdLocal(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function combineLocalDateTime(dateYmd: string, timeHm: string): Date | null {
  if (!dateYmd || !timeHm) return null;
  const d = new Date(`${dateYmd}T${timeHm}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Do not mix `weekday` with `dateStyle`/`timeStyle` — that throws in many engines. */
export function formatAppointmentDateTime(dt: Date): string {
  return dt.toLocaleString(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  });
}

export function toDateAndTimeInputs(d: Date): { date: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
