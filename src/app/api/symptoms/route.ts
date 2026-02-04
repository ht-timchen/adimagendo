import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const UpsertSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  painLevel: z.number().min(0).max(10).optional(),
  symptoms: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59);

  const entries = await prisma.symptomEntry.findMany({
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
    const parsed = UpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { date, painLevel, symptoms, notes } = parsed.data;
    const dateObj = new Date(date + "T12:00:00");

    const symptomsJson = Array.isArray(symptoms) ? symptoms : [];

    const entry = await prisma.symptomEntry.upsert({
      where: {
        userId_date: { userId: session.user.id, date: dateObj },
      },
      create: {
        userId: session.user.id,
        date: dateObj,
        painLevel: painLevel ?? null,
        symptoms: symptomsJson,
        notes: notes ?? null,
      },
      update: {
        painLevel: painLevel ?? null,
        symptoms: symptomsJson,
        notes: notes ?? null,
      },
    });
    return NextResponse.json(entry);
  } catch (e) {
    console.error("Symptom upsert error:", e);
    return NextResponse.json(
      { error: "Failed to save entry" },
      { status: 500 }
    );
  }
}
