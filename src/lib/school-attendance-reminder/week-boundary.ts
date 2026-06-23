import { endOfWeek, startOfWeek } from "date-fns";

/**
 * Calendar week for school-attendance reminders: Monday 00:00 through Sunday 23:59:59.999
 * (local time). The Diary UI is month-scoped only; this matches the banner copy "this week".
 */
export function getCalendarWeekRange(referenceDate: Date): {
  start: Date;
  end: Date;
} {
  return {
    start: startOfWeek(referenceDate, { weekStartsOn: 1 }),
    end: endOfWeek(referenceDate, { weekStartsOn: 1 }),
  };
}
