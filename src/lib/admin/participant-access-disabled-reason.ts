import { ADMIN_AUDIT_ACTIONS } from "@/lib/admin-audit";
import { prisma } from "@/lib/db";

export async function getParticipantAccessDisabledReason(
  userId: string
): Promise<string | null> {
  const event = await prisma.adminAuditEvent.findFirst({
    where: {
      targetType: "participant",
      targetId: userId,
      action: ADMIN_AUDIT_ACTIONS.PARTICIPANT_DEACTIVATED,
    },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
  });
  if (!event?.metadata || typeof event.metadata !== "object" || event.metadata === null) {
    return null;
  }
  const reason = (event.metadata as { reason?: unknown }).reason;
  return typeof reason === "string" && reason.trim() ? reason.trim() : null;
}
