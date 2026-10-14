import type { PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";
import {
  ADMIN_AUDIT_ACTIONS,
  createAdminAuditEventInTx,
  snapshotActorFromSession,
} from "@/lib/admin-audit";
import {
  BROADCAST_BODY_MAX,
  BROADCAST_TITLE_MAX,
  CONTACT_REPLY_NOTIFICATION_TYPE,
  buildBroadcastPushPayload,
  type BroadcastPushSummary,
} from "@/lib/notifications/broadcast-notifications";
import { sendPushToUsers, type PushPayload, type PushToUsersResult } from "@/lib/push/send-to-user";

export type ContactReplyInput = { title: string; body: string; submissionId: string };

/**
 * The only text a reply's phone push shows. The admin's title can reveal what the
 * conversation is about on a lock screen, so it stays in the app.
 */
export const CONTACT_REPLY_PUSH_TEXT = "You have a new message from the study team.";

/**
 * Reads only the title, body and submission id. Anything else in the request (a user id,
 * a recipient list) is ignored: the recipient always comes from the message itself.
 */
export function validateContactReplyInput(
  raw: unknown
): { ok: true; input: ContactReplyInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid request." };
  const record = raw as Record<string, unknown>;

  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > BROADCAST_TITLE_MAX) {
    return { ok: false, error: `Title must be ${BROADCAST_TITLE_MAX} characters or fewer.` };
  }

  const body = typeof record.body === "string" ? record.body.trim() : "";
  if (!body) return { ok: false, error: "Message is required." };
  if (body.length > BROADCAST_BODY_MAX) {
    return { ok: false, error: `Message must be ${BROADCAST_BODY_MAX} characters or fewer.` };
  }

  const submissionId = typeof record.submissionId === "string" ? record.submissionId.trim() : "";
  if (!/^[A-Za-z0-9-]{8,64}$/.test(submissionId)) {
    return { ok: false, error: "Invalid request." };
  }

  return { ok: true, input: { title, body, submissionId } };
}

/** First word of the participant's name, or null when there is no name. */
export function participantFirstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

export type ContactReplyRecipient = { name: string | null; email: string };

export type ContactReplyOutcome =
  | { status: "created"; replyId: string; recipient: ContactReplyRecipient; push: BroadcastPushSummary }
  | { status: "replayed"; recipient: ContactReplyRecipient };

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function replyPushSentence(firstName: string | null, push: BroadcastPushSummary): { text: string; ok: boolean } {
  switch (push.state) {
    case "not-configured":
      return { text: "Phone push could not be sent because push isn't set up on this server.", ok: false };
    case "failed":
      return { text: "Phone push could not be sent. The reply is in Study Buddy.", ok: false };
    case "sent": {
      if (push.devices === 0 && push.failed === 0) {
        const who = firstName ?? "The participant";
        return {
          text: `${who} hasn't turned on phone push, so nothing was pushed. They'll see it under Notifications.`,
          ok: true,
        };
      }
      if (push.devices === 0) {
        return { text: `Phone push could not be sent (${plural(push.failed, "device", "devices")} failed).`, ok: false };
      }
      const failed = push.failed > 0 ? `; ${plural(push.failed, "device", "devices")} could not be reached` : "";
      return { text: `Phone push sent to ${plural(push.devices, "device", "devices")}${failed}.`, ok: push.failed === 0 };
    }
  }
}

/**
 * Message shown to the admin. It says what was stored and what was handed to the push
 * service, never that the participant received or read it.
 */
export function contactReplyResultMessage(outcome: ContactReplyOutcome): {
  tone: "success" | "warning";
  text: string;
} {
  const name = outcome.recipient.name?.trim() || outcome.recipient.email;
  if (outcome.status === "replayed") {
    return { tone: "success", text: `Reply sent to ${name}. This reply had already been sent, so nothing was added.` };
  }
  const push = replyPushSentence(participantFirstName(outcome.recipient.name), outcome.push);
  return { tone: push.ok ? "success" : "warning", text: `Reply sent to ${name}. ${push.text}` };
}

export type ContactReplyErrorCode = "not_found" | "deactivated" | "not_participant" | "in_progress" | "invalid_request";

const CONTACT_REPLY_ERROR_MESSAGES: Record<ContactReplyErrorCode, string> = {
  not_found: "Message not found.",
  deactivated: "This participant's account is deactivated",
  not_participant: "Replies can only be sent to participants.",
  in_progress: "This reply is already being sent.",
  invalid_request: "Invalid request.",
};

export class ContactReplyError extends Error {
  constructor(readonly code: ContactReplyErrorCode) {
    super(CONTACT_REPLY_ERROR_MESSAGES[code]);
    this.name = "ContactReplyError";
  }
}

export function contactReplyErrorStatus(code: ContactReplyErrorCode): number {
  switch (code) {
    case "not_found":
      return 404;
    case "in_progress":
      return 409;
    default:
      return 400;
  }
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "P2002";
}

export type ContactReplyPushSender = (userIds: readonly string[], payload: PushPayload) => Promise<PushToUsersResult>;

type ContactReplyDb = Pick<PrismaClient, "$transaction" | "contactMessageReply">;

/** Submission ids being processed right now in this server process (guards a double click). */
const inFlight = new Set<string>();

async function pushReply(
  recipientId: string,
  sendPush: ContactReplyPushSender
): Promise<BroadcastPushSummary> {
  try {
    const result = await sendPush([recipientId], buildBroadcastPushPayload(CONTACT_REPLY_PUSH_TEXT));
    return {
      state: "sent",
      devices: result.sent,
      failed: result.failed,
      recipientsWithoutPush: 1 - result.usersWithSubscription,
    };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Push is not configured")) {
      return { state: "not-configured" };
    }
    console.error("Contact reply push failed:", e instanceof Error ? e.name : "unknown error");
    return { state: "failed" };
  }
}

async function findEarlierReply(
  db: Pick<PrismaClient, "contactMessageReply">,
  submissionId: string,
  contactMessageId: string
): Promise<ContactReplyOutcome | null> {
  const earlier = await db.contactMessageReply.findUnique({
    where: { submissionId },
    select: {
      contactMessageId: true,
      contactMessage: { select: { user: { select: { name: true, email: true } } } },
    },
  });
  if (!earlier) return null;
  if (earlier.contactMessageId !== contactMessageId) throw new ContactReplyError("invalid_request");
  return { status: "replayed", recipient: earlier.contactMessage.user };
}

/**
 * Reply to one participant's contact message. The recipient is always the author of the
 * message, read from the database; nothing in the request can change it.
 *
 * The in-app notification, the reply row and the audit event are written in one transaction.
 * The same `submissionId` again (double click, retry) returns the earlier result without a
 * second notification or push. The phone push (fixed text, never the admin's title or body)
 * runs after the transaction and never undoes the reply.
 */
export async function replyToContactMessage(
  db: ContactReplyDb,
  input: ContactReplyInput & {
    session: Session;
    contactMessageId: string;
    /** Defaults to real Web Push. */
    sendPush?: ContactReplyPushSender;
  }
): Promise<ContactReplyOutcome> {
  const { session, contactMessageId, title, body, submissionId } = input;
  const sendPush = input.sendPush ?? ((ids, payload) => sendPushToUsers(ids, payload));

  if (inFlight.has(submissionId)) throw new ContactReplyError("in_progress");
  inFlight.add(submissionId);
  try {
    const earlier = await findEarlierReply(db, submissionId, contactMessageId);
    if (earlier) return earlier;

    let stored: { replyId: string; recipientId: string; recipient: ContactReplyRecipient };
    try {
      stored = await db.$transaction(async (tx) => {
        const message = await tx.contactMessage.findUnique({
          where: { id: contactMessageId },
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                profile: { select: { studyRecordId: true } },
              },
            },
          },
        });
        if (!message) throw new ContactReplyError("not_found");
        const author = message.user;
        if (author.role !== "PARTICIPANT") throw new ContactReplyError("not_participant");
        if (!author.isActive) throw new ContactReplyError("deactivated");

        const notification = await tx.notification.create({
          data: { userId: author.id, title, body, type: CONTACT_REPLY_NOTIFICATION_TYPE },
          select: { id: true },
        });
        const reply = await tx.contactMessageReply.create({
          data: {
            contactMessageId: message.id,
            adminUserId: session.user.id,
            adminName: snapshotActorFromSession(session).actorName,
            notificationId: notification.id,
            submissionId,
          },
          select: { id: true },
        });
        await createAdminAuditEventInTx(tx, {
          session,
          action: ADMIN_AUDIT_ACTIONS.CONTACT_MESSAGE_REPLIED,
          targetType: "contact_message",
          targetId: message.id,
          targetName: author.profile?.studyRecordId?.trim() || null,
          metadata: { contactMessageId: message.id, notificationId: notification.id },
        });
        return {
          replyId: reply.id,
          recipientId: author.id,
          recipient: { name: author.name, email: author.email },
        };
      });
    } catch (e) {
      // Another server process stored this submission first.
      if (isUniqueConflict(e)) {
        const replay = await findEarlierReply(db, submissionId, contactMessageId);
        if (replay) return replay;
      }
      throw e;
    }

    const push = await pushReply(stored.recipientId, sendPush);
    return { status: "created", replyId: stored.replyId, recipient: stored.recipient, push };
  } finally {
    inFlight.delete(submissionId);
  }
}
