import { cookies } from "next/headers";
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
