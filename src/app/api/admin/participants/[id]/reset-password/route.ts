import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { generateTemporaryPassword } from "@/lib/admin-people";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (!user || user.role !== Role.PARTICIPANT) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!user.isActive) {
    return NextResponse.json({ error: "Participant is inactive" }, { status: 400 });
  }

  try {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash, inviteToken: null, inviteTokenExpiry: null },
    });

    return NextResponse.json({
      ok: true,
      email: user.email,
      temporaryPassword,
    });
  } catch (e) {
    console.error("POST /api/admin/participants/[id]/reset-password:", e);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
