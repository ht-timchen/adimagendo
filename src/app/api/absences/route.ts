import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const AbsenceReasonEnum = z.enum(["MEDICAL", "SYMPTOMS", "APPOINTMENT", "OTHER"]);

const CreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  halfDay: z.boolean().optional(),
  reason: AbsenceReasonEnum,
  context: z.string().optional(), // "work" | "school"
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59);

  const entries = await prisma.absenceEntry.findMany({
    where: {
      userId: session.user.id,
      date: { gte: start, lte: end },
    },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(entries);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { date, halfDay, reason, context, notes } = parsed.data;
    const dateObj = new Date(date + "T12:00:00");

    const entry = await prisma.absenceEntry.create({
      data: {
        userId: session.user.id,
        date: dateObj,
        halfDay: halfDay ?? false,
        reason,
        context: context ?? null,
        notes: notes ?? null,
      },
    });
    return NextResponse.json(entry);
  } catch (e) {
    console.error("Absence create error:", e);
    return NextResponse.json(
      { error: "Failed to save absence" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  await prisma.absenceEntry.deleteMany({
    where: { id, userId: session.user.id },
  });
  return NextResponse.json({ ok: true });
}
