import { cookies } from "next/headers";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

export const ADMIN_CONTACT_MESSAGES_SEEN_COOKIE = "admin_contact_messages_seen_at";

export async function countUnreadContactMessages(): Promise<number> {
  const cookieStore = await cookies();
  const lastSeenRaw = cookieStore.get(ADMIN_CONTACT_MESSAGES_SEEN_COOKIE)?.value;
  const since = lastSeenRaw ? new Date(lastSeenRaw) : null;
  if (!since || Number.isNaN(since.getTime())) {
    return prisma.contactMessage.count();
  }
  return prisma.contactMessage.count({
    where: { createdAt: { gt: since } },
  });
}

type InboxDb = Pick<PrismaClient, "contactMessage" | "user">;

/** One line of the inbox or of a participant's message history. */
export type ContactMessageSummary = {
  id: string;
  subject: string;
  category: string | null;
  createdAt: Date;
  preview: string;
};

export type ContactMessageRow = ContactMessageSummary & {
  participant: { id: string; name: string | null; email: string };
  /** At least one admin reply has been sent for this message. */
  replied: boolean;
};

export type ContactMessageStatusFilter = "all" | "awaiting";

/** "awaiting" from the URL; anything else shows all messages. */
export function parseContactMessageStatusFilter(raw: string | undefined): ContactMessageStatusFilter {
  return raw === "awaiting" ? "awaiting" : "all";
}

/** Admin-facing read status of a reply. Only "Mark as read" sets it, not viewing the page. */
export function contactReplyReadLabel(read: boolean): string {
  return read ? "Marked as read" : "Not marked as read yet";
}

/** One admin reply as shown on the message page. Title and body come from its Notification. */
export type ContactMessageReplyView = {
  id: string;
  adminName: string;
  createdAt: Date;
  title: string;
  /** Plain text. Render it as text, never as HTML. */
  body: string | null;
  /** The participant tapped "Mark as read" on the notification. */
  read: boolean;
};

export const OTHER_MESSAGES_LIMIT = 20;
const PREVIEW_LENGTH = 120;

/** One-line preview with whitespace collapsed. Display only: never used to store or compare. */
export function previewMessage(text: string, max = PREVIEW_LENGTH): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max)}…`;
}

export type ContactMessageDetail = {
  message: {
    id: string;
    subject: string;
    category: string | null;
    /** Full text, exactly as the participant wrote it. Render it as plain text. */
    body: string;
    createdAt: Date;
    participant: {
      id: string;
      name: string | null;
      email: string;
      /** REDCap record ID of the linked participant profile, if there is one. */
      studyRecordId: string | null;
    };
  };
  /** False when the participant's account is deactivated; replies are then refused. */
  participantActive: boolean;
  /** Admin replies to this message, oldest first. */
  replies: ContactMessageReplyView[];
  /** The same participant's other messages, newest first, at most OTHER_MESSAGES_LIMIT. */
  otherMessages: ContactMessageSummary[];
};

/** Null when the message does not exist. */
export async function getContactMessageDetail(
  id: string,
  db: InboxDb = prisma
): Promise<ContactMessageDetail | null> {
  const found = await db.contactMessage.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          profile: { select: { studyRecordId: true } },
        },
      },
      replies: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          adminName: true,
          createdAt: true,
          notification: { select: { title: true, body: true, read: true } },
        },
      },
    },
  });
  if (!found) return null;

  const others = await db.contactMessage.findMany({
    where: { userId: found.userId, id: { not: found.id } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: OTHER_MESSAGES_LIMIT,
    select: { id: true, subject: true, category: true, createdAt: true, message: true },
  });

  return {
    message: {
      id: found.id,
      subject: found.subject,
      category: found.category,
      body: found.message,
      createdAt: found.createdAt,
      participant: {
        id: found.user.id,
        name: found.user.name,
        email: found.user.email,
        studyRecordId: found.user.profile?.studyRecordId?.trim() || null,
      },
    },
    participantActive: found.user.isActive,
    replies: found.replies.map((reply) => ({
      id: reply.id,
      adminName: reply.adminName,
      createdAt: reply.createdAt,
      title: reply.notification.title,
      body: reply.notification.body,
      read: reply.notification.read,
    })),
    otherMessages: others.map((m) => ({
      id: m.id,
      subject: m.subject,
      category: m.category,
      createdAt: m.createdAt,
      preview: previewMessage(m.message),
    })),
  };
}

/**
 * The inbox, newest first. With `participantUserId` only that participant's messages are
 * returned and `participant` says who they are. An id that matches nobody is ignored: the
 * full inbox comes back and `participant` is null. `status: "awaiting"` keeps only messages
 * without a reply; it combines with the participant filter.
 */
export async function listContactMessages(
  options: { participantUserId?: string; status?: ContactMessageStatusFilter } = {},
  db: InboxDb = prisma
): Promise<{
  messages: ContactMessageRow[];
  participant: { id: string; name: string | null; email: string } | null;
}> {
  const requested = options.participantUserId?.trim();
  const participant =
    requested && requested.length <= 64
      ? await db.user.findUnique({
          where: { id: requested },
          select: { id: true, name: true, email: true },
        })
      : null;

  const rows = await db.contactMessage.findMany({
    where: {
      ...(participant ? { userId: participant.id } : {}),
      ...(options.status === "awaiting" ? { replies: { none: {} } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { replies: true } },
    },
  });

  return {
    participant,
    messages: rows.map((row) => ({
      id: row.id,
      subject: row.subject,
      category: row.category,
      createdAt: row.createdAt,
      preview: previewMessage(row.message),
      participant: row.user,
      replied: row._count.replies > 0,
    })),
  };
}
