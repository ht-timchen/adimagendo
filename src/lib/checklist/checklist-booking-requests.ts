import { prisma } from "@/lib/db";
import {
  ConfirmExternalAppointmentError,
  confirmExternalAppointment,
  type ConfirmExternalAppointmentResult,
} from "@/lib/checklist/confirm-external-appointment";
import {
  getStepCompletionBlock,
  type StepUnavailableError,
} from "@/lib/workflow/assert-step-available";

export type BookingRequestResult = { status: number; body: unknown };

type BookingDb = Pick<typeof prisma, "checklistTemplate" | "participantChecklistItem">;

type BookingDeps = {
  db?: BookingDb;
  getBlock?: (userId: string, checklistKey: string) => Promise<StepUnavailableError | null>;
};

/** POST /api/checklist/book-externally after auth and body validation. */
export async function bookChecklistItemExternally(
  params: { userId: string; templateId: string },
  deps: BookingDeps = {}
): Promise<BookingRequestResult> {
  const db = deps.db ?? prisma;
  const getBlock = deps.getBlock ?? getStepCompletionBlock;
  const { userId, templateId } = params;

  const template = await db.checklistTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template?.externalUrl?.trim()) {
    return {
      status: 400,
      body: { error: "This item does not use external booking." },
    };
  }

  const block = await getBlock(userId, template.key);
  if (block) return { status: 403, body: block };

  const existing = await db.participantChecklistItem.findUnique({
    where: { userId_templateId: { userId, templateId } },
  });

  if (existing?.bookingProgress === "CONFIRMED") {
    return { status: 200, body: { ok: true, checklistItemId: existing.id } };
  }

  const item = await db.participantChecklistItem.upsert({
    where: { userId_templateId: { userId, templateId } },
    create: {
      userId,
      templateId,
      status: "PENDING",
      bookingProgress: "BOOKED_EXTERNALLY",
      bookedExternallyAt: new Date(),
    },
    update: {
      bookingProgress: "BOOKED_EXTERNALLY",
      bookedExternallyAt: new Date(),
    },
  });

  return { status: 200, body: { ok: true, checklistItemId: item.id } };
}

/** POST /api/checklist/confirm-appointment after auth and body validation. */
export async function confirmChecklistAppointment(
  params: {
    userId: string;
    templateId: string;
    scheduledStartAt: string;
    scheduledLocation?: string | null;
  },
  deps: BookingDeps & {
    confirm?: typeof confirmExternalAppointment;
  } = {}
): Promise<BookingRequestResult> {
  const db = deps.db ?? prisma;
  const getBlock = deps.getBlock ?? getStepCompletionBlock;
  const confirm = deps.confirm ?? confirmExternalAppointment;
  const { userId, templateId } = params;

  const item = await db.participantChecklistItem.findUnique({
    where: { userId_templateId: { userId, templateId } },
    include: { template: { select: { key: true } } },
  });

  if (!item) {
    return {
      status: 404,
      body: { error: "Checklist item not found. Use Book Now first." },
    };
  }

  if (item.status === "COMPLETED" && item.bookingProgress === "CONFIRMED") {
    return { status: 200, body: { ok: true, alreadyCompleted: true } };
  }

  const block = await getBlock(userId, item.template.key);
  if (block) return { status: 403, body: block };

  const loc =
    params.scheduledLocation?.trim() === ""
      ? null
      : params.scheduledLocation?.trim() ?? null;

  try {
    const result: ConfirmExternalAppointmentResult = await confirm({
      userId,
      checklistItemId: item.id,
      scheduledStartAt: new Date(params.scheduledStartAt),
      scheduledLocation: loc,
    });
    return { status: 200, body: { ok: true, ...result } };
  } catch (e) {
    if (e instanceof ConfirmExternalAppointmentError) {
      return { status: e.status, body: { error: e.message } };
    }
    console.error("POST /api/checklist/confirm-appointment:", e);
    return { status: 500, body: { error: "Failed to confirm appointment." } };
  }
}
