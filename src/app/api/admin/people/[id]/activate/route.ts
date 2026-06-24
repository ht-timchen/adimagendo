import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/admin-api-auth";
import { isStaffUser } from "@/lib/admin-people";
import { ADMIN_AUDIT_ACTIONS, recordAdminAuditEvent } from "@/lib/admin-audit";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission("admin_user:update");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user || !isStaffUser(user.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.user.update({
      where: { id },
      data: { isActive: true },
    });
    await recordAdminAuditEvent({
      session,
      action: ADMIN_AUDIT_ACTIONS.STAFF_ACTIVATED,
      targetType: "staff",
      targetId: id,
      targetName: user.name?.trim() || user.email,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH activate:", e);
    return NextResponse.json({ error: "Failed to activate" }, { status: 500 });
  }
}
