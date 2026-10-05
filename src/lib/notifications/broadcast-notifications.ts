import type { PrismaClient } from "@prisma/client";
import { isLevelCompleteNotificationType } from "@/lib/checklist/level-complete-notifications";

/** In-app notification created by an admin broadcast to all active participants. */
export const BROADCAST_NOTIFICATION_TYPE = "admin_broadcast";

export const BROADCAST_TITLE_MAX = 120;
export const BROADCAST_BODY_MAX = 2000;
const UNREAD_BADGE_MAX_DISPLAY = 9;

export function isBroadcastNotificationType(type: string | null | undefined): boolean {
  return type === BROADCAST_NOTIFICATION_TYPE;
}

/** Types a participant may mark as read through /api/notifications/[id]/read. */
export function isParticipantReadableNotificationType(type: string | null | undefined): boolean {
  if (!type) return false;
  return isLevelCompleteNotificationType(type) || isBroadcastNotificationType(type);
}

export function formatUnreadBadge(count: number): string | null {
  if (count <= 0) return null;
  if (count > UNREAD_BADGE_MAX_DISPLAY) return `${UNREAD_BADGE_MAX_DISPLAY}+`;
  return String(count);
}

export function notificationsLinkAriaLabel(count: number): string {
  if (count <= 0) return "Notifications";
  if (count > UNREAD_BADGE_MAX_DISPLAY) return `Notifications – ${UNREAD_BADGE_MAX_DISPLAY}+ unread`;
  return `Notifications – ${count} unread`;
}

export type BroadcastInput = { title: string; body: string | null; submissionId: string };

export function validateBroadcastInput(
  raw: unknown
): { ok: true; input: BroadcastInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid request." };
  const record = raw as Record<string, unknown>;

  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > BROADCAST_TITLE_MAX) {
    return { ok: false, error: `Title must be ${BROADCAST_TITLE_MAX} characters or fewer.` };
  }

  const body = typeof record.body === "string" ? record.body.trim() : "";
  if (body.length > BROADCAST_BODY_MAX) {
    return { ok: false, error: `Message must be ${BROADCAST_BODY_MAX} characters or fewer.` };
  }

  const submissionId = typeof record.submissionId === "string" ? record.submissionId.trim() : "";
  if (!/^[A-Za-z0-9-]{8,64}$/.test(submissionId)) {
    return { ok: false, error: "Invalid request." };
  }

  return { ok: true, input: { title, body: body || null, submissionId } };
}

/** What happened to the phone push that goes out with a broadcast. */
export type BroadcastPushSummary =
  | { state: "sent"; devices: number; failed: number; recipientsWithoutPush: number }
  | { state: "not-configured" }
  | { state: "failed" };

export type BroadcastOutcome =
  | { status: "created"; count: number; push?: BroadcastPushSummary }
  | { status: "replayed"; count: number }
  | { status: "no-recipients" };

/** Where tapping the phone push leads: the message itself is read in the app. */
export const BROADCAST_PUSH_URL = "/dashboard/notifications";

/**
 * Phone push for a broadcast: the title only. The text is shown the same way as a single-
 * participant push without a message (blank title, text as body); the full message is read
 * in the app after tapping.
 */
export function buildBroadcastPushPayload(title: string): { title: string; body: string; url: string } {
  return { title: " ", body: title, url: BROADCAST_PUSH_URL };
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function participants(count: number): string {
  return plural(count, "active participant", "active participants");
}

function pushSentence(push: BroadcastPushSummary): { text: string; ok: boolean } {
  switch (push.state) {
    case "not-configured":
      return { text: "Phone push could not be sent because push isn't set up on this server.", ok: false };
    case "failed":
      return { text: "Phone push could not be sent. The in-app notifications are in place.", ok: false };
    case "sent": {
      if (push.devices === 0 && push.failed === 0) {
        return { text: "No participant has turned on phone push yet, so nothing was pushed.", ok: true };
      }
      if (push.devices === 0) {
        return { text: `Phone push could not be sent (${plural(push.failed, "device", "devices")} failed).`, ok: false };
      }
      const parts = [`Phone push sent to ${plural(push.devices, "device", "devices")}`];
      if (push.recipientsWithoutPush > 0) {
        parts.push(`${plural(push.recipientsWithoutPush, "participant hasn't", "participants haven't")} turned on push`);
      }
      if (push.failed > 0) parts.push(`${plural(push.failed, "device", "devices")} could not be reached`);
      return { text: `${parts.join("; ")}.`, ok: push.failed === 0 };
    }
  }
}

/**
 * Message shown to the admin. It states what was created and what was handed to the push
 * service, never that anyone received or read it.
 */
export function broadcastResultMessage(outcome: BroadcastOutcome): {
  tone: "success" | "info" | "warning";
  text: string;
} {
  switch (outcome.status) {
    case "created": {
      const base = `Notification created for ${participants(outcome.count)}.`;
      if (!outcome.push) return { tone: "success", text: base };
      const push = pushSentence(outcome.push);
      return { tone: push.ok ? "success" : "warning", text: `${base} ${push.text}` };
    }
    case "replayed":
      return {
        tone: "success",
        text: `Notification created for ${participants(outcome.count)}. This broadcast had already been sent, so nothing was added.`,
      };
    case "no-recipients":
      return { tone: "info", text: "No active participants to notify." };
  }
}

export type ParticipantNotificationItem = {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  read: boolean;
};

type ReadDb = Pick<PrismaClient, "notification">;

export async function getParticipantUnreadBroadcastCount(db: ReadDb, userId: string): Promise<number> {
  return db.notification.count({
    where: { userId, type: BROADCAST_NOTIFICATION_TYPE, read: false },
  });
}

/** Newest first. Only this user's broadcasts; other notification types are not listed. */
export async function listParticipantBroadcasts(
  db: ReadDb,
  userId: string,
  take = 50
): Promise<ParticipantNotificationItem[]> {
  const rows = await db.notification.findMany({
    where: { userId, type: BROADCAST_NOTIFICATION_TYPE },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true, title: true, body: true, read: true, createdAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Mark one of the participant's own notifications as read. Anything that is not theirs, does
 * not exist, or is not a readable type answers "not-found" and is left untouched. Safe to repeat.
 */
export async function markNotificationRead(
  db: ReadDb,
  input: { userId: string; notificationId: string }
): Promise<"ok" | "not-found"> {
  const notification = await db.notification.findFirst({
    where: { id: input.notificationId, userId: input.userId },
    select: { id: true, type: true },
  });
  if (!notification || !isParticipantReadableNotificationType(notification.type)) return "not-found";

  await db.notification.update({ where: { id: notification.id }, data: { read: true } });
  return "ok";
}
