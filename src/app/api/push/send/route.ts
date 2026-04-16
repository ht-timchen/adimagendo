import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  setVapidDetails,
  sendNotification,
  WebPushError,
} from "web-push";
import { z } from "zod";

const BodySchema = z.object({
  userId: z.string().min(1).optional(),
  title: z.string().trim().min(1),
  message: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1).optional(),
  url: z.string().default("/"),
});

function vapidSubject(mailto: string) {
  const t = mailto.trim();
  if (t.startsWith("mailto:") || t.startsWith("https:")) return t;
  return `mailto:${t}`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const mailto = process.env.VAPID_MAILTO;

  if (!publicKey?.trim() || !privateKey?.trim() || !mailto?.trim()) {
    return NextResponse.json(
      { error: "Push is not configured (VAPID keys or VAPID_MAILTO missing)" },
      { status: 500 }
    );
  }

  let parsed: z.infer<typeof BodySchema>;
  try {
    const json = await req.json();
    const result = BodySchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    parsed = result.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, title, message, body, url } = parsed;
  const rawMessage = (message ?? body ?? "").trim();
  const finalTitle = " ";
  const finalBody = rawMessage ? rawMessage : title;
  const payload = JSON.stringify({ title: finalTitle, body: finalBody, url });

  setVapidDetails(vapidSubject(mailto), publicKey, privateKey);

  const subscriptions = await prisma.pushSubscription.findMany(
    userId ? { where: { userId } } : undefined
  );

  if (userId && subscriptions.length === 0) {
    return NextResponse.json(
      { error: "User has no active push subscription" },
      { status: 404 }
    );
  }

  if (!userId && subscriptions.length === 0) {
    return NextResponse.json(
      { error: "No active push subscriptions" },
      { status: 404 }
    );
  }

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
        payload
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

  if (sent === 0) {
    const error = userId
      ? "Notification could not be delivered. The participant may have disabled notifications or their subscription may have expired."
      : "No notifications were delivered.";
    return NextResponse.json({ error }, { status: 502 });
  }

  return NextResponse.json(
    {
      ok: true,
      target: userId ?? "all",
      subscriptions: subscriptions.length,
      sent,
      removed,
      failed,
    },
    { status: 200 }
  );
}
