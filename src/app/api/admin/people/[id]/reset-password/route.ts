import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-api-auth";
import {
  generateInviteToken,
  generateTemporaryPassword,
  isStaffUser,
  PROTECTED_ADMIN_EMAIL,
} from "@/lib/admin-people";
import { isSmtpConfigured, sendInviteEmail, SMTP_NOT_CONFIGURED_MSG } from "@/lib/mail";

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
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  if (!user || !isStaffUser(user.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (user.email.toLowerCase() === PROTECTED_ADMIN_EMAIL) {
    return NextResponse.json(
      { error: "Password for this account is managed in the database." },
      { status: 403 }
    );
  }

  if (!user.isActive) {
    return NextResponse.json({ error: "User is deactivated" }, { status: 400 });
  }

  try {
    if (!isSmtpConfigured()) {
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);

      await prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          inviteToken: null,
          inviteTokenExpiry: null,
        },
      });

      return NextResponse.json({
        ok: true,
        delivery: "manual",
        emailSent: false,
        email: user.email,
        temporaryPassword,
      });
    }

    const token = generateInviteToken();
    const inviteTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id },
      data: { inviteToken: token, inviteTokenExpiry },
    });

    const mail = await sendInviteEmail({
      to: user.email,
      name: user.name?.trim() || user.email,
      token,
      subject: "ADIMAGENDO — reset your password",
    });

    return NextResponse.json({
      ok: true,
      delivery: "email",
      emailSent: mail.sent,
      warning: mail.sent ? undefined : SMTP_NOT_CONFIGURED_MSG,
    });
  } catch (e) {
    console.error("POST reset-password:", e);
    return NextResponse.json({ error: "Failed to send reset email" }, { status: 500 });
  }
}
