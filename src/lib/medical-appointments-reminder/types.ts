/** Client-safe types/constants (no Prisma imports). */

export type MedicalAppointmentsBannerState = {
  cycleId: string;
  stage: "INITIAL" | "FIRST_FOLLOWUP" | "SECOND_FOLLOWUP";
};

export const MEDICAL_APPOINTMENTS_DIARY_PATH = "/dashboard/appointments";

export type MedicalAppointmentsReminderAction = "yes" | "no" | "dismiss";
