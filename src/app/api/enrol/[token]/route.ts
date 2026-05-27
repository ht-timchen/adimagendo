import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const name =
      typeof body === "object" && body !== null && "name" in body
        ? String((body as { name: unknown }).name).trim()
        : "";
    const emailRaw =
      typeof body === "object" && body !== null && "email" in body
        ? String((body as { email: unknown }).email).trim()
        : "";
    const password =
      typeof body === "object" && body !== null && "password" in body
        ? String((body as { password: unknown }).password)
        : "";
    const studyRecordId =
      typeof body === "object" && body !== null && "studyRecordId" in body
        ? String((body as { studyRecordId: unknown }).studyRecordId).trim()
        : "";

    if (!name || !emailRaw || !password || !studyRecordId) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const email = emailRaw.toLowerCase();

    const enrolment = await prisma.enrolmentToken.findFirst({
      where: { token, studyRecordId },
    });

    if (!enrolment) {
      return NextResponse.json({ error: "Invalid link" }, { status: 400 });
    }

    if (enrolment.usedAt) {
      return NextResponse.json({ error: "Link already used" }, { status: 400 });
    }

    if (enrolment.expiresAt < new Date()) {
      return NextResponse.json({ error: "Link has expired" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: "PARTICIPANT",
          isActive: true,
        },
      });

      await tx.participantProfile.create({
        data: {
          userId: user.id,
          studyRecordId,
          enrollmentDate: new Date(),
        },
      });

      await tx.enrolmentToken.update({
        where: { id: enrolment.id },
        data: { usedAt: new Date() },
      });
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("POST /api/enrol/[token]:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
