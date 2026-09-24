import {
  dismissReminder,
  getReminderBannerState,
  processDueReminders,
  respondToReminder,
  type ProcessDueRemindersResult,
  type ReminderBannerState,
} from "@/lib/reminder-cycle/process";

export type { ProcessDueRemindersResult };
export type MedicalAppointmentsBannerState = ReminderBannerState;

export function getMedicalAppointmentsBannerState(
  userId: string,
  now = new Date()
): Promise<MedicalAppointmentsBannerState | null> {
  return getReminderBannerState("medical_appointments", userId, now);
}

export function dismissMedicalAppointmentsReminder(
  cycleId: string,
  userId: string,
  now = new Date()
): Promise<boolean> {
  return dismissReminder("medical_appointments", cycleId, userId, now);
}

export function respondMedicalAppointmentsReminder(params: {
  cycleId: string;
  userId: string;
  action: "yes" | "no";
  now?: Date;
}): Promise<"YES" | "NO"> {
  return respondToReminder({
    ...params,
    reminderType: "medical_appointments",
  });
}

export function processDueMedicalAppointmentsReminders(
  now = new Date()
): Promise<ProcessDueRemindersResult> {
  return processDueReminders("medical_appointments", now);
}
