import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { email, password, name } = parsed.data;
    const emailLower = email.toLowerCase();

    const existing = await prisma.user.findUnique({
      where: { email: emailLower },
    });
    if (existing) {
      return NextResponse.json(
        { error: { email: ["An account with this email already exists."] } },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: emailLower,
        passwordHash,
        name: name ?? null,
        role: "PARTICIPANT",
      },
    });

    // Create participant profile with default enrollment date (today)
    await prisma.participantProfile.create({
      data: {
        userId: user.id,
        enrollmentDate: new Date(),
        studyPhase: "baseline",
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Account created. You can now sign in.",
    });
  } catch (e) {
    console.error("Register error:", e);
    const errMessage = e instanceof Error ? e.message : "";
    const isDbUnreachable =
      /can't reach database server|connection refused|ECONNREFUSED|getaddrinfo/i.test(
        errMessage
      );
    const message = isDbUnreachable
      ? "Database is not available. Set DATABASE_URL in .env to a PostgreSQL URL (see README for free options like Neon)."
      : process.env.NODE_ENV === "development"
        ? errMessage || "Something went wrong. Please try again."
        : "Something went wrong. Please try again.";
    return NextResponse.json(
      { error: { _: [message] } },
      { status: 500 }
    );
  }
}
