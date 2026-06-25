import { NextResponse } from "next/server";
import { requireParticipantApiSession } from "@/lib/participant-api-auth";
import { prisma } from "@/lib/db";
import {
  ConfirmExternalAppointmentError,
  confirmExternalAppointment,
} from "@/lib/checklist/confirm-external-appointment";
import { alreadyCompletedResponse } from "@/lib/workflow/completion-response";
import { z } from "zod";

const BodySchema = z.object({
  templateId: z.string().min(1),
  scheduledStartAt: z.string().min(1),
  scheduledLocation: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const authResult = await requireParticipantApiSession();
  if (!authResult.ok) return authResult.response;
  const { userId } = authResult.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const item = await prisma.participantChecklistItem.findUnique({
    where: {
      userId_templateId: {
        userId: userId,
        templateId: parsed.data.templateId,
      },
    },
  });

  if (!item) {
    return NextResponse.json(
      { error: "Checklist item not found. Use Book Now first." },
      { status: 404 }
    );
  }

  if (
    item.status === "COMPLETED" &&
    item.bookingProgress === "CONFIRMED"
  ) {
    return alreadyCompletedResponse();
  }

  const loc =
    parsed.data.scheduledLocation?.trim() === ""
      ? null
      : parsed.data.scheduledLocation?.trim() ?? null;

  try {
    const result = await confirmExternalAppointment({
      userId: userId,
      checklistItemId: item.id,
      scheduledStartAt: new Date(parsed.data.scheduledStartAt),
      scheduledLocation: loc,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof ConfirmExternalAppointmentError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("POST /api/checklist/confirm-appointment:", e);
    return NextResponse.json({ error: "Failed to confirm appointment." }, { status: 500 });
  }
}
