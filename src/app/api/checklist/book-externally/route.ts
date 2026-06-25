import { NextResponse } from "next/server";
import { requireParticipantApiSession } from "@/lib/participant-api-auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const BodySchema = z.object({
  templateId: z.string().min(1),
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

  const template = await prisma.checklistTemplate.findUnique({
    where: { id: parsed.data.templateId },
  });
  if (!template?.externalUrl?.trim()) {
    return NextResponse.json(
      { error: "This item does not use external booking." },
      { status: 400 }
    );
  }

  const existing = await prisma.participantChecklistItem.findUnique({
    where: {
      userId_templateId: {
        userId: userId,
        templateId: parsed.data.templateId,
      },
    },
  });

  if (existing?.bookingProgress === "CONFIRMED") {
    return NextResponse.json({ ok: true, checklistItemId: existing.id });
  }

  const item = await prisma.participantChecklistItem.upsert({
    where: {
      userId_templateId: {
        userId: userId,
        templateId: parsed.data.templateId,
      },
    },
    create: {
      userId: userId,
      templateId: parsed.data.templateId,
      status: "PENDING",
      bookingProgress: "BOOKED_EXTERNALLY",
      bookedExternallyAt: new Date(),
    },
    update: {
      bookingProgress: "BOOKED_EXTERNALLY",
      bookedExternallyAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, checklistItemId: item.id });
}
