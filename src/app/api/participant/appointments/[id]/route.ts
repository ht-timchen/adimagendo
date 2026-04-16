import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const PatchBodySchema = z.object({
  scheduledStartAt: z.string().min(1),
  scheduledLocation: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const start = new Date(parsed.data.scheduledStartAt);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid date and time." }, { status: 400 });
  }
  if (start.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Please choose a future date and time." },
      { status: 400 }
    );
  }

  const loc =
    parsed.data.scheduledLocation?.trim() === ""
      ? null
      : parsed.data.scheduledLocation?.trim() ?? null;

  const existing = await prisma.appointment.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status === "CANCELLED") {
    return NextResponse.json(
      { error: "Cannot edit a cancelled appointment." },
      { status: 400 }
    );
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      startAt: start,
      scheduledStartAt: start,
      scheduledLocation: loc,
      location: loc,
    },
  });

  return NextResponse.json({
    ok: true,
    appointment: {
      id: updated.id,
      startAt: updated.startAt.toISOString(),
      scheduledStartAt: updated.scheduledStartAt?.toISOString() ?? null,
      scheduledLocation: updated.scheduledLocation,
      location: updated.location,
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.appointment.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status === "CANCELLED") {
    return NextResponse.json({ ok: true });
  }

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    if (existing.participantChecklistItemId) {
      const item = await tx.participantChecklistItem.findUnique({
        where: { id: existing.participantChecklistItemId },
      });
      const nextProgress =
        item?.bookedExternallyAt != null ? "BOOKED_EXTERNALLY" : "NOT_STARTED";
      await tx.participantChecklistItem.update({
        where: { id: existing.participantChecklistItemId },
        data: {
          status: "PENDING",
          completedAt: null,
          bookingProgress: nextProgress,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
