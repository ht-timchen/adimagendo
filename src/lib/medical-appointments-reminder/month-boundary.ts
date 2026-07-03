/**
 * Calendar month helpers for medical-appointments reminders.
 */

export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getCalendarMonthRange(referenceDate: Date): {
  start: Date;
  end: Date;
} {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth() + 1;
  const lastDay = getLastDayOfMonth(year, month);

  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month - 1, lastDay)),
  };
}
