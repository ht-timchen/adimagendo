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
          profile: { select: { studyRecordId: true } },
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
 * full inbox comes back and `participant` is null.
 */
export async function listContactMessages(
  options: { participantUserId?: string } = {},
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
    where: participant ? { userId: participant.id } : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { user: { select: { id: true, name: true, email: true } } },
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
    })),
  };
}
