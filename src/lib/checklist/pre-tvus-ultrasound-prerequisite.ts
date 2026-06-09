import type { WorkflowBookingProgress } from "@/lib/workflow/types";

export const PRE_TVUS_ULTRASOUND_BOOKING_LOCK_MESSAGE =
  "Book your ultrasound first to unlock this survey.";

export const PRE_TVUS_ULTRASOUND_APPOINTMENT_LOCK_MESSAGE =
  "Confirm your ultrasound appointment date and time to unlock this survey.";

export function getUltrasoundAppointmentDateTime(
  appointment:
    | {
        scheduledStartAt: Date | null;
        startAt: Date;
      }
    | null
    | undefined
): Date | null {
  if (!appointment) return null;
  return appointment.scheduledStartAt ?? appointment.startAt ?? null;
}

export function isPreTvusUltrasoundBookingPrerequisiteMet(params: {
  bookingProgress: WorkflowBookingProgress | undefined;
  appointmentDateTime: Date | null | undefined;
}): boolean {
  const { bookingProgress, appointmentDateTime } = params;
  if (
    bookingProgress !== "BOOKED_EXTERNALLY" &&
    bookingProgress !== "CONFIRMED"
  ) {
    return false;
  }
  if (appointmentDateTime == null) return false;
  return !Number.isNaN(new Date(appointmentDateTime).getTime());
}

export function preTvusUltrasoundBookingLockReason(params: {
  bookingProgress: WorkflowBookingProgress | undefined;
  appointmentDateTime: Date | null | undefined;
}): string {
  if (
    params.bookingProgress !== "BOOKED_EXTERNALLY" &&
    params.bookingProgress !== "CONFIRMED"
  ) {
    return PRE_TVUS_ULTRASOUND_BOOKING_LOCK_MESSAGE;
  }
  return PRE_TVUS_ULTRASOUND_APPOINTMENT_LOCK_MESSAGE;
}
