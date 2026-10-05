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

export type PushSubscriptionTarget = { endpoint: string; p256dh: string; auth: string };

/** Sends one wire payload to one subscription. Throws a WebPushError on failure. */
export type PushDelivery = (subscription: PushSubscriptionTarget, wirePayload: string) => Promise<void>;

export type PushToUsersResult = PushSendResult & {
  /** Distinct users who have at least one stored subscription. */
  usersWithSubscription: number;
};

const DEFAULT_PUSH_CONCURRENCY = 8;
const PUSH_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Push to every subscription of the given users, a few at a time. A subscription the push
 * service reports as gone (404/410) is removed. `sent` means the push service accepted the
 * message: it says nothing about whether the phone showed it. Pass `deliver` to avoid the
 * network (tests); otherwise VAPID must be configured or this throws "Push is not configured".
 */
export async function sendPushToUsers(
  userIds: readonly string[],
  payload: PushPayload,
  options: { deliver?: PushDelivery; concurrency?: number } = {}
): Promise<PushToUsersResult> {
  if (userIds.length === 0) return { sent: 0, removed: 0, failed: 0, usersWithSubscription: 0 };

  let deliver = options.deliver;
  if (!deliver) {
    ensureVapidConfigured();
    deliver = async (subscription, wirePayload) => {
      await sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        wirePayload,
        { timeout: PUSH_REQUEST_TIMEOUT_MS }
      );
    };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: [...userIds] } },
  });
  const wirePayload = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;
  let failed = 0;
  let next = 0;

  async function worker() {
    for (;;) {
      const sub = subscriptions[next++];
      if (!sub) return;
      try {
        await deliver!(sub, wirePayload);
        sent += 1;
      } catch (err) {
        const status = err instanceof WebPushError ? err.statusCode : undefined;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          removed += 1;
        } else {
          failed += 1;
          console.error("Push send error:", status ?? (err instanceof Error ? err.name : "unknown"));
        }
      }
    }
  }

  const workers = Math.min(options.concurrency ?? DEFAULT_PUSH_CONCURRENCY, subscriptions.length);
  await Promise.all(Array.from({ length: workers }, worker));

  return {
    sent,
    removed,
    failed,
    usersWithSubscription: new Set(subscriptions.map((sub) => sub.userId)).size,
  };
}
