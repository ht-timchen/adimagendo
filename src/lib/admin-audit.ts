import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const ADMIN_AUDIT_ACTIONS = {
  STAFF_CREATED: "staff.created",
  STAFF_ROLE_CHANGED: "staff.role_changed",
  STAFF_DEACTIVATED: "staff.deactivated",
  STAFF_ACTIVATED: "staff.activated",
  STAFF_DELETED: "staff.deleted",
  STAFF_PASSWORD_RESET: "staff.password_reset",
  SETTINGS_UPDATED: "settings.updated",
  REDCAP_SYNC_TRIGGERED: "redcap.sync_triggered",
  SYMPTOM_DIARY_EXPORTED: "symptom_diary.exported",
  PARTICIPANT_PASSWORD_RESET: "participant.password_reset",
  PARTICIPANT_DEACTIVATED: "participant.deactivated",
  PARTICIPANT_ACTIVATED: "participant.activated",
  NOTIFICATION_BROADCAST_SENT: "notification.broadcast_sent",
} as const;

export type AdminAuditAction =
  (typeof ADMIN_AUDIT_ACTIONS)[keyof typeof ADMIN_AUDIT_ACTIONS];

export function snapshotActorFromSession(session: Session): {
  actorUserId: string;
  actorName: string;
  actorRole: string;
} {
  const actorUserId = session.user.id;
  const actorName =
    session.user.name?.trim() || session.user.email?.trim() || "Unknown";
  const actorRole =
    session.user.superAdmin === true
      ? "SUPER_ADMIN"
      : (session.user.role ?? "UNKNOWN");
  return { actorUserId, actorName, actorRole };
}

export async function recordAdminAuditEvent(input: {
  session: Session;
  action: AdminAuditAction | string;
  targetType: string;
  targetId?: string | null;
  targetName?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const { actorUserId, actorName, actorRole } = snapshotActorFromSession(
    input.session
  );

  try {
    await prisma.adminAuditEvent.create({
      data: {
        actorUserId,
        actorName,
        actorRole,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        targetName: input.targetName ?? null,
        metadata:
          input.metadata != null
            ? (input.metadata as Prisma.InputJsonValue)
            : undefined,
      },
    });
  } catch (error) {
    console.error("[admin-audit] failed to record event", {
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      error,
    });
  }
}
