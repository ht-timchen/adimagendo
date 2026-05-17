import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ valid: false, error: "Missing token" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { inviteToken: token },
    select: { id: true, inviteTokenExpiry: true, email: true, name: true },
  });

  if (!user?.inviteTokenExpiry || user.inviteTokenExpiry < new Date()) {
    return NextResponse.json({ valid: false, error: "Invalid or expired" }, { status: 400 });
  }

  return NextResponse.json({
    valid: true,
    email: user.email,
    name: user.name,
  });
}

const PostSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { token, password } = parsed.data;

    const user = await prisma.user.findFirst({
      where: { inviteToken: token },
      select: { id: true, inviteTokenExpiry: true },
    });

    if (!user?.inviteTokenExpiry || user.inviteTokenExpiry < new Date()) {
      return NextResponse.json(
        { error: "This invite link is invalid or has expired." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        inviteToken: null,
        inviteTokenExpiry: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST accept-invite:", e);
    return NextResponse.json({ error: "Failed to set password" }, { status: 500 });
  }
}
