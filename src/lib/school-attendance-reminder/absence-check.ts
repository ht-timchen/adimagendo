import { prisma } from "@/lib/db";
import { getCalendarWeekRange } from "./week-boundary";

export async function hasAbsenceEntryForCurrentWeek(
  userId: string,
  referenceDate = new Date()
): Promise<boolean> {
  const { start, end } = getCalendarWeekRange(referenceDate);

  const count = await prisma.absenceEntry.count({
    where: {
      userId,
      date: { gte: start, lte: end },
    },
  });

  return count > 0;
}
