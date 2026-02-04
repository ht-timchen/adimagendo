import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

const BodySchema = z.object({
  answers: z.record(z.string(), z.unknown()),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: templateId } = await params;
  const template = await prisma.surveyTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const answers = parsed.data.answers as Prisma.InputJsonValue;
    await prisma.surveyResponse.upsert({
      where: {
        userId_templateId: { userId: session.user.id, templateId },
      },
      create: {
        userId: session.user.id,
        templateId,
        answers,
        completed: true,
        completedAt: new Date(),
      },
      update: {
        answers,
        completed: true,
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Survey submit error:", e);
    return NextResponse.json(
      { error: "Failed to submit" },
      { status: 500 }
    );
  }
}
