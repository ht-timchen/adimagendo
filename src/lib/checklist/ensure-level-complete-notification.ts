import { prisma } from "@/lib/db";
import {
  LEVEL_COMPLETE_NOTIFICATION_COPY,
  type LevelCompleteNotificationType,
} from "./level-complete-notifications";

export async function ensureLevelCompleteNotification(
  userId: string,
  type: LevelCompleteNotificationType
): Promise<void> {
  const existing = await prisma.notification.findFirst({
    where: { userId, type },
    select: { id: true },
  });
  if (existing) return;

  await prisma.notification.create({
    data: {
      userId,
      title: LEVEL_COMPLETE_NOTIFICATION_COPY[type],
      body: null,
      type,
      read: false,
    },
  });
}
