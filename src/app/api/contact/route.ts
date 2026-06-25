import { NextResponse } from "next/server";
import { requireParticipantApiSession } from "@/lib/participant-api-auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const BodySchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
  category: z.string().optional(),
});

export async function POST(req: Request) {
  const authResult = await requireParticipantApiSession();
  if (!authResult.ok) return authResult.response;
  const { userId } = authResult.ctx;
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { subject, message, category } = parsed.data;
    await prisma.contactMessage.create({
      data: {
        userId: userId,
        subject,
        message,
        category: category ?? null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Contact form error:", e);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
