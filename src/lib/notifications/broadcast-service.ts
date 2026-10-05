import type { Prisma, PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";
import { ADMIN_AUDIT_ACTIONS, createAdminAuditEventInTx, recordAdminAuditEvent } from "@/lib/admin-audit";
import {
  BROADCAST_NOTIFICATION_TYPE,
  buildBroadcastPushPayload,
  type BroadcastInput,
  type BroadcastOutcome,
  type BroadcastPushSummary,
} from "@/lib/notifications/broadcast-notifications";
import { sendPushToUsers, type PushPayload, type PushToUsersResult } from "@/lib/push/send-to-user";

type BroadcastDb = Pick<PrismaClient, "$transaction" | "adminAuditEvent">;

export type BroadcastAuditWriter = (
  tx: Prisma.TransactionClient,
  entry: { session: Session; title: string; recipientCount: number; submissionId: string }
) => Promise<void>;

const writeBroadcastAudit: BroadcastAuditWriter = (tx, { session, title, recipientCount, submissionId }) =>
  createAdminAuditEventInTx(tx, {
    session,
    action: ADMIN_AUDIT_ACTIONS.NOTIFICATION_BROADCAST_SENT,
    targetType: "notification",
    targetName: "All participants",
    metadata: { title, recipientCount, submissionId },
  });

export type BroadcastPushSender = (userIds: readonly string[], payload: PushPayload) => Promise<PushToUsersResult>;

/**
 * Phone push for a broadcast that has already been stored. Best effort: it never undoes the
 * in-app notifications, and "sent" only means the push service accepted the message.
 */
async function pushToRecipients(
  recipientIds: readonly string[],
  title: string,
  sendPush: BroadcastPushSender
): Promise<BroadcastPushSummary> {
  try {
    const result = await sendPush(recipientIds, buildBroadcastPushPayload(title));
    return {
      state: "sent",
      devices: result.sent,
      failed: result.failed,
      recipientsWithoutPush: recipientIds.length - result.usersWithSubscription,
    };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Push is not configured")) {
      return { state: "not-configured" };
    }
    console.error("Broadcast push failed:", e instanceof Error ? e.name : "unknown error");
    return { state: "failed" };
  }
}

/** Submission ids being processed right now in this server process (guards a double click). */
const inFlight = new Set<string>();

export class BroadcastInProgressError extends Error {
  constructor() {
    super("This broadcast is already being sent.");
    this.name = "BroadcastInProgressError";
  }
}

/** A broadcast with this submission id that already succeeded, found in the audit trail. */
async function findCompletedBroadcast(
  db: Pick<PrismaClient, "adminAuditEvent">,
  submissionId: string
): Promise<number | null> {
  const events = await db.adminAuditEvent.findMany({
    where: { action: ADMIN_AUDIT_ACTIONS.NOTIFICATION_BROADCAST_SENT },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { metadata: true },
  });
  for (const event of events) {
    const metadata = event.metadata as { submissionId?: unknown; recipientCount?: unknown } | null;
    if (metadata?.submissionId === submissionId) {
      return typeof metadata.recipientCount === "number" ? metadata.recipientCount : 0;
    }
  }
  return null;
}

/**
 * Create one in-app notification per active participant (role PARTICIPANT, isActive true).
 *
 * The notifications and their audit record are written in one transaction: if either fails
 * nothing is kept, so the admin sees a failure and a retry cannot create duplicates.
 * `submissionId` comes from the form. Sending the same id again (double click, a retry after
 * a timeout) returns the earlier result instead of creating another set; a deliberate new
 * broadcast with the same text uses a new id and goes through.
 */
export async function broadcastToActiveParticipants(
  db: BroadcastDb,
  input: BroadcastInput & {
    session: Session;
    writeAudit?: BroadcastAuditWriter;
    /** Phone push after the in-app notifications are stored. Defaults to real Web Push. */
    sendPush?: BroadcastPushSender;
  }
): Promise<BroadcastOutcome> {
  const { title, body, submissionId, session } = input;
  const writeAudit = input.writeAudit ?? writeBroadcastAudit;
  const sendPush = input.sendPush ?? ((ids, payload) => sendPushToUsers(ids, payload));

  if (inFlight.has(submissionId)) throw new BroadcastInProgressError();
  inFlight.add(submissionId);
  try {
    const earlier = await findCompletedBroadcast(db, submissionId);
    if (earlier !== null) return { status: "replayed", count: earlier };

    const stored = await db.$transaction(
      async (tx): Promise<{ recipientIds: string[]; count: number } | null> => {
        const recipients = await tx.user.findMany({
          where: { role: "PARTICIPANT", isActive: true },
          select: { id: true },
        });
        if (recipients.length === 0) return null;

        const created = await tx.notification.createMany({
          data: recipients.map((user) => ({
            userId: user.id,
            title,
            body,
            type: BROADCAST_NOTIFICATION_TYPE,
          })),
        });
        await writeAudit(tx, { session, title, recipientCount: created.count, submissionId });
        return { recipientIds: recipients.map((user) => user.id), count: created.count };
      }
    );
    if (!stored) return { status: "no-recipients" };

    // Only after the notifications are safely stored, and only for this first send:
    // a replay returned above and never pushes again.
    const push = await pushToRecipients(stored.recipientIds, title, sendPush);
    await recordAdminAuditEvent({
      session,
      action: ADMIN_AUDIT_ACTIONS.NOTIFICATION_BROADCAST_PUSH_SENT,
      targetType: "notification",
      targetName: "All participants",
      metadata: {
        submissionId,
        state: push.state,
        ...(push.state === "sent"
          ? { devices: push.devices, failed: push.failed, recipientsWithoutPush: push.recipientsWithoutPush }
          : {}),
      },
    });
    return { status: "created", count: stored.count, push };
  } finally {
    inFlight.delete(submissionId);
  }
}
