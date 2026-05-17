import { prisma } from "@/lib/db";
import { getStepCompletionBlock } from "@/lib/workflow/assert-step-available";

export type ConfirmExternalAppointmentResult = {
  appointmentId: string;
  scheduledStartAt: string;
};

export class ConfirmExternalAppointmentError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

/**
 * Confirms an externally booked checklist step: sets booking CONFIRMED,
 * marks the checklist item COMPLETED, and upserts the linked Appointment.
 */
export async function confirmExternalAppointment(params: {
  userId: string;
  checklistItemId: string;
  scheduledStartAt: Date;
  scheduledLocation: string | null;
}): Promise<ConfirmExternalAppointmentResult> {
  const { userId, checklistItemId, scheduledStartAt, scheduledLocation } =
    params;

  const item = await prisma.participantChecklistItem.findFirst({
    where: { id: checklistItemId, userId },
    include: { template: true },
  });

  if (!item) {
    throw new ConfirmExternalAppointmentError("Checklist item not found.", 404);
  }

  if (!item.template.externalUrl?.trim()) {
    throw new ConfirmExternalAppointmentError(
      "This item does not use external booking.",
      400
    );
  }

  const workflowBlock = await getStepCompletionBlock(userId, item.template.key);
  if (workflowBlock) {
    throw new ConfirmExternalAppointmentError(
      workflowBlock.reasons.length > 0
        ? workflowBlock.reasons.join(" ")
        : "Step unavailable",
      403
    );
  }

  if (
    item.status === "COMPLETED" &&
    item.bookingProgress === "CONFIRMED"
  ) {
    const existing = await prisma.appointment.findUnique({
      where: { participantChecklistItemId: item.id },
    });
    return {
      appointmentId: existing?.id ?? "",
      scheduledStartAt:
        existing?.scheduledStartAt?.toISOString() ??
        scheduledStartAt.toISOString(),
    };
  }

  if (Number.isNaN(scheduledStartAt.getTime())) {
    throw new ConfirmExternalAppointmentError("Invalid date and time.", 400);
  }
  if (scheduledStartAt.getTime() <= Date.now()) {
    throw new ConfirmExternalAppointmentError(
      "Please choose a future date and time.",
      400
    );
  }

  if (
    item.bookingProgress !== "BOOKED_EXTERNALLY" &&
    item.bookingProgress !== "CONFIRMED"
  ) {
    throw new ConfirmExternalAppointmentError(
      'Tap "Book Now" on the booking site first, then confirm your appointment details.',
      400
    );
  }

  const title = item.template.title;
  const description = item.template.description ?? null;
  const externalUrl = item.template.externalUrl.trim();

  const appointment = await prisma.$transaction(async (tx) => {
    await tx.participantChecklistItem.update({
      where: { id: item.id },
      data: {
        bookingProgress: "CONFIRMED",
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    return tx.appointment.upsert({
      where: { participantChecklistItemId: item.id },
      create: {
        userId,
        title,
        description,
        startAt: scheduledStartAt,
        endAt: null,
        location: scheduledLocation,
        externalUrl,
        status: "CONFIRMED",
        scheduledStartAt,
        scheduledLocation,
        participantChecklistItemId: item.id,
      },
      update: {
        title,
        description,
        startAt: scheduledStartAt,
        location: scheduledLocation,
        externalUrl,
        status: "CONFIRMED",
        scheduledStartAt,
        scheduledLocation,
      },
    });
  });

  return {
    appointmentId: appointment.id,
    scheduledStartAt:
      appointment.scheduledStartAt?.toISOString() ??
      scheduledStartAt.toISOString(),
  };
}
