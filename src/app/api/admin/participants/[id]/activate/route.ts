import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/admin-api-auth";
import { ADMIN_AUDIT_ACTIONS, recordAdminAuditEvent } from "@/lib/admin-audit";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission("participant:update");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  if (!user || user.role !== Role.PARTICIPANT) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (user.isActive) {
    return NextResponse.json({ error: "Participant is already active" }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id },
      data: { isActive: true },
    });
    await recordAdminAuditEvent({
      session,
      action: ADMIN_AUDIT_ACTIONS.PARTICIPANT_ACTIVATED,
      targetType: "participant",
      targetId: id,
      targetName: user.name?.trim() || user.email,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/admin/participants/[id]/activate:", e);
    return NextResponse.json({ error: "Failed to activate" }, { status: 500 });
  }
}
