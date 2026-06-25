import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/admin-api-auth";
import { ADMIN_AUDIT_ACTIONS, recordAdminAuditEvent } from "@/lib/admin-audit";

const BodySchema = z.object({
  reason: z.string().trim().min(1, "Reason is required").max(50),
});

export async function PATCH(
  req: Request,
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

  if (!user.isActive) {
    return NextResponse.json({ error: "Participant is already inactive" }, { status: 400 });
  }

  let reason: string;
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      const message =
        parsed.error.flatten().fieldErrors.reason?.[0] ?? "Invalid request";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    reason = parsed.data.reason;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    await recordAdminAuditEvent({
      session,
      action: ADMIN_AUDIT_ACTIONS.PARTICIPANT_DEACTIVATED,
      targetType: "participant",
      targetId: id,
      targetName: user.name?.trim() || user.email,
      metadata: { reason },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/admin/participants/[id]/deactivate:", e);
    return NextResponse.json({ error: "Failed to deactivate" }, { status: 500 });
  }
}
