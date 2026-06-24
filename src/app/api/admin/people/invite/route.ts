import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/admin-api-auth";
import {
  generateInviteToken,
  generateTemporaryPassword,
  parsePeopleRoleInput,
} from "@/lib/admin-people";
import { hasPermission } from "@/lib/admin-rbac";
import { isSmtpConfigured, sendInviteEmail, SMTP_NOT_CONFIGURED_MSG } from "@/lib/mail";
import { ADMIN_AUDIT_ACTIONS, recordAdminAuditEvent } from "@/lib/admin-audit";

const BodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]).optional(),
  /** `email` sends invite link; `manual` returns a one-time temp password for the admin to share. */
  delivery: z.enum(["email", "manual"]).optional(),
});

export async function POST(req: Request) {
  const session = await requirePermission("admin_user:create");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const name = parsed.data.name.trim();
    const email = parsed.data.email.trim().toLowerCase();
    const requesterIsSuper = hasPermission(session, "role:manage");

    let roleInput = parsed.data.role ?? "USER";
    if (!requesterIsSuper) {
      roleInput = "USER";
    }

    const { prismaRole, superAdmin } = parsePeopleRoleInput(roleInput);

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const useEmail =
      parsed.data.delivery === "email" || (parsed.data.delivery !== "manual" && isSmtpConfigured());

    if (useEmail && !isSmtpConfigured()) {
      return NextResponse.json(
        {
          error:
            "Email delivery is not available. Configure SMTP in .env or choose manual password delivery.",
        },
        { status: 400 }
      );
    }

    if (useEmail) {
      const token = generateInviteToken();
      const inviteTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const created = await prisma.user.create({
        data: {
          email,
          name,
          role: prismaRole,
          superAdmin,
          isActive: true,
          inviteToken: token,
          inviteTokenExpiry,
          passwordHash: null,
        },
      });

      const mail = await sendInviteEmail({ to: email, name, token });

      await recordAdminAuditEvent({
        session,
        action: ADMIN_AUDIT_ACTIONS.STAFF_CREATED,
        targetType: "staff",
        targetId: created.id,
        targetName: name,
        metadata: { email, role: roleInput, delivery: "email" },
      });

      return NextResponse.json({
        ok: true,
        delivery: "email",
        emailSent: mail.sent,
        warning: mail.sent ? undefined : SMTP_NOT_CONFIGURED_MSG,
      });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const created = await prisma.user.create({
      data: {
        email,
        name,
        role: prismaRole,
        superAdmin,
        isActive: true,
        passwordHash,
        inviteToken: null,
        inviteTokenExpiry: null,
      },
    });

    await recordAdminAuditEvent({
      session,
      action: ADMIN_AUDIT_ACTIONS.STAFF_CREATED,
      targetType: "staff",
      targetId: created.id,
      targetName: name,
      metadata: { email, role: roleInput, delivery: "manual" },
    });

    return NextResponse.json({
      ok: true,
      delivery: "manual",
      emailSent: false,
      email,
      temporaryPassword,
    });
  } catch (e) {
    console.error("POST /api/admin/people/invite:", e);
    return NextResponse.json({ error: "Failed to send invite" }, { status: 500 });
  }
}
