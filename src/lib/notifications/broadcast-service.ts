import type { Prisma, PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";
import { ADMIN_AUDIT_ACTIONS, createAdminAuditEventInTx } from "@/lib/admin-audit";
import {
  BROADCAST_NOTIFICATION_TYPE,
  type BroadcastInput,
  type BroadcastOutcome,
} from "@/lib/notifications/broadcast-notifications";

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
  input: BroadcastInput & { session: Session; writeAudit?: BroadcastAuditWriter }
): Promise<BroadcastOutcome> {
  const { title, body, submissionId, session } = input;
  const writeAudit = input.writeAudit ?? writeBroadcastAudit;

  if (inFlight.has(submissionId)) throw new BroadcastInProgressError();
  inFlight.add(submissionId);
  try {
    const earlier = await findCompletedBroadcast(db, submissionId);
    if (earlier !== null) return { status: "replayed", count: earlier };

    return await db.$transaction(async (tx): Promise<BroadcastOutcome> => {
      const recipients = await tx.user.findMany({
        where: { role: "PARTICIPANT", isActive: true },
        select: { id: true },
      });
      if (recipients.length === 0) return { status: "no-recipients" };

      const created = await tx.notification.createMany({
        data: recipients.map((user) => ({
          userId: user.id,
          title,
          body,
          type: BROADCAST_NOTIFICATION_TYPE,
        })),
      });
      await writeAudit(tx, { session, title, recipientCount: created.count, submissionId });
      return { status: "created", count: created.count };
    });
  } finally {
    inFlight.delete(submissionId);
  }
}
