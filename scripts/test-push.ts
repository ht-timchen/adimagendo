/**
 * Temporary script: send a test web push to the first stored subscription.
 * Run: npx tsx scripts/test-push.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { setVapidDetails, sendNotification } from "web-push";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

function vapidSubject(mailto: string) {
  const t = mailto.trim();
  if (t.startsWith("mailto:") || t.startsWith("https:")) return t;
  return `mailto:${t}`;
}

const prisma = new PrismaClient();

async function main() {
  const sub = await prisma.pushSubscription.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!sub) {
    console.error("No PushSubscription rows in database.");
    process.exit(1);
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const mailto = process.env.VAPID_MAILTO;

  if (!publicKey?.trim() || !privateKey?.trim() || !mailto?.trim()) {
    console.error(
      "Missing VAPID env: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, or VAPID_MAILTO (.env.local)"
    );
    process.exit(1);
  }

  setVapidDetails(vapidSubject(mailto), publicKey, privateKey);

  const payload = JSON.stringify({
    title: "Test",
    body: "Hello from ADIMAGENDO!",
    url: "/",
  });

  await sendNotification(
    {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    },
    payload
  );

  console.log("Push sent OK (first subscription by createdAt).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
