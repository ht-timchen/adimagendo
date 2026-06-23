import { prisma } from "@/lib/db";
import {
  setVapidDetails,
  sendNotification,
  WebPushError,
} from "web-push";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

export type PushSendResult = {
  sent: number;
  removed: number;
  failed: number;
};

function vapidSubject(mailto: string) {
  const t = mailto.trim();
  if (t.startsWith("mailto:") || t.startsWith("https:")) return t;
  return `mailto:${t}`;
}

function ensureVapidConfigured() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const mailto = process.env.VAPID_MAILTO;

  if (!publicKey?.trim() || !privateKey?.trim() || !mailto?.trim()) {
    throw new Error(
      "Push is not configured (VAPID keys or VAPID_MAILTO missing)"
    );
  }

  setVapidDetails(vapidSubject(mailto), publicKey, privateKey);
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<PushSendResult> {
  ensureVapidConfigured();

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  const wirePayload = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        wirePayload
      );
      sent += 1;
    } catch (err) {
      if (err instanceof WebPushError && err.statusCode === 410) {
        await prisma.pushSubscription.delete({
          where: { id: sub.id },
        });
        removed += 1;
      } else {
        failed += 1;
        console.error("Push send error:", err);
      }
    }
  }

  return { sent, removed, failed };
}

export async function sendPushToAllUsers(
  payload: PushPayload
): Promise<PushSendResult> {
  ensureVapidConfigured();

  const subscriptions = await prisma.pushSubscription.findMany();
  const wirePayload = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        wirePayload
      );
      sent += 1;
    } catch (err) {
      if (err instanceof WebPushError && err.statusCode === 410) {
        await prisma.pushSubscription.delete({
          where: { id: sub.id },
        });
        removed += 1;
      } else {
        failed += 1;
        console.error("Push send error:", err);
      }
    }
  }

  return { sent, removed, failed };
}
