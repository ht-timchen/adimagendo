/** Client-safe types/constants (no Prisma imports). */

export type SchoolAttendanceBannerState = {
  cycleId: string;
  stage: "INITIAL" | "FIRST_FOLLOWUP" | "SECOND_FOLLOWUP";
};

export const SCHOOL_ATTENDANCE_DIARY_PATH = "/dashboard/absences";

export type SchoolAttendanceReminderAction = "yes" | "no";
