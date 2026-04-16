import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const BodySchema = z.object({
  templateId: z.string().min(1),
  scheduledStartAt: z.string().min(1),
  scheduledLocation: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const { templateId, scheduledStartAt, scheduledLocation } = parsed.data;
  const start = new Date(scheduledStartAt);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json(
      { error: "Invalid date and time." },
      { status: 400 }
    );
  }
  if (start.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Please choose a future date and time." },
      { status: 400 }
    );
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template?.externalUrl?.trim()) {
    return NextResponse.json(
      { error: "This item does not use external booking." },
      { status: 400 }
    );
  }

  const item = await prisma.participantChecklistItem.findUnique({
    where: {
      userId_templateId: { userId: session.user.id, templateId },
    },
  });

  if (
    !item ||
    (item.bookingProgress !== "BOOKED_EXTERNALLY" &&
      item.bookingProgress !== "CONFIRMED")
  ) {
    return NextResponse.json(
      {
        error:
          "Use \"I've finished booking\" first, then confirm your appointment details.",
      },
      { status: 400 }
    );
  }

  const loc =
    scheduledLocation?.trim() === ""
      ? null
      : scheduledLocation?.trim() ?? null;

  const title = template.title;
  const description = template.description ?? null;
  const externalUrl = template.externalUrl.trim();

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
        userId: session.user.id,
        title,
        description,
        startAt: start,
        endAt: null,
        location: loc,
        externalUrl,
        status: "CONFIRMED",
        scheduledStartAt: start,
        scheduledLocation: loc,
        participantChecklistItemId: item.id,
      },
      update: {
        title,
        description,
        startAt: start,
        location: loc,
        externalUrl,
        status: "CONFIRMED",
        scheduledStartAt: start,
        scheduledLocation: loc,
      },
    });
  });

  return NextResponse.json({
    ok: true,
    appointmentId: appointment.id,
    scheduledStartAt: appointment.scheduledStartAt?.toISOString() ?? null,
  });
}
