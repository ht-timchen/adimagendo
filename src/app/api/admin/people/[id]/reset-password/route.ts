import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/admin-api-auth";
import {
  generateInviteToken,
  generateTemporaryPassword,
  isStaffUser,
  PROTECTED_ADMIN_EMAIL,
} from "@/lib/admin-people";
import {
  buildStaffEmailDeliveryResponse,
  buildStaffManualCredentialsResponse,
  formatMailDeliveryError,
  formatStaffActionUserError,
  resolveStaffResetDelivery,
  sendInviteEmail,
  STAFF_EMAIL_UNAVAILABLE_USER_MSG,
} from "@/lib/mail";
import { ADMIN_AUDIT_ACTIONS, recordAdminAuditEvent } from "@/lib/admin-audit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission("admin_user:reset_password");
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
    const deliveryPath = resolveStaffResetDelivery();

    if (deliveryPath === "unavailable") {
      return NextResponse.json({ error: STAFF_EMAIL_UNAVAILABLE_USER_MSG }, { status: 400 });
    }

    if (deliveryPath === "manual") {
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

      await recordAdminAuditEvent({
        session,
        action: ADMIN_AUDIT_ACTIONS.STAFF_PASSWORD_RESET,
        targetType: "staff",
        targetId: id,
        targetName: user.name?.trim() || user.email,
        metadata: { delivery: "manual" },
      });

      return NextResponse.json(
        buildStaffManualCredentialsResponse(user.email, temporaryPassword)
      );
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

    if (!mail.sent) {
      console.warn("[mail] Staff password reset email was not sent", {
        email: user.email,
        detail: formatMailDeliveryError(
          new Error("SMTP not configured or dev preview only")
        ),
      });
    }

    await recordAdminAuditEvent({
      session,
      action: ADMIN_AUDIT_ACTIONS.STAFF_PASSWORD_RESET,
      targetType: "staff",
      targetId: id,
      targetName: user.name?.trim() || user.email,
      metadata: { delivery: "email", emailSent: mail.sent },
    });

    return NextResponse.json(buildStaffEmailDeliveryResponse());
  } catch (e) {
    console.error("POST reset-password:", {
      detail: formatMailDeliveryError(e),
      err: e,
    });
    return NextResponse.json(
      { error: formatStaffActionUserError(e, "reset_password") },
      { status: 500 }
    );
  }
}
