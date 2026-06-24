import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  sendPushToAllUsers,
  sendPushToUser,
} from "@/lib/push/send-to-user";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { hasPermission } from "@/lib/admin-rbac";
import { ADMIN_AUDIT_ACTIONS, recordAdminAuditEvent } from "@/lib/admin-audit";

const BodySchema = z.object({
  userId: z.string().min(1).optional(),
  title: z.string().trim().min(1),
  message: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1).optional(),
  url: z.string().default("/"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const json = await req.json().catch(() => null);
  const isBroadcastRequest =
    json != null &&
    typeof json === "object" &&
    (!("userId" in json) || !(json as { userId?: unknown }).userId);
  const allowed = isBroadcastRequest
    ? hasPermission(session, "notification:broadcast")
    : hasPermission(session, "notification:send");
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let parsed: z.infer<typeof BodySchema>;
  try {
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
  const payload = { title: finalTitle, body: finalBody, url };

  if (userId) {
    const subscriptionCount = await prisma.pushSubscription.count({
      where: { userId },
    });
    if (subscriptionCount === 0) {
      return NextResponse.json(
        { error: "User has no active push subscription" },
        { status: 404 }
      );
    }
  } else {
    const subscriptionCount = await prisma.pushSubscription.count();
    if (subscriptionCount === 0) {
      return NextResponse.json(
        { error: "No active push subscriptions" },
        { status: 404 }
      );
    }
  }

  try {
    const result = userId
      ? await sendPushToUser(userId, payload)
      : await sendPushToAllUsers(payload);

    if (result.sent === 0) {
      const error = userId
        ? "Notification could not be delivered. The participant may have disabled notifications or their subscription may have expired."
        : "No notifications were delivered.";
      return NextResponse.json({ error }, { status: 502 });
    }

    if (isBroadcastRequest) {
      await recordAdminAuditEvent({
        session,
        action: ADMIN_AUDIT_ACTIONS.NOTIFICATION_BROADCAST_SENT,
        targetType: "notification",
        targetName: "All push subscribers",
        metadata: { title: finalTitle, body: finalBody, sent: result.sent },
      });
    }

    const subscriptions = userId
      ? await prisma.pushSubscription.count({ where: { userId } })
      : await prisma.pushSubscription.count();

    return NextResponse.json(
      {
        ok: true,
        target: userId ?? "all",
        subscriptions,
        sent: result.sent,
        removed: result.removed,
        failed: result.failed,
      },
      { status: 200 }
    );
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Push is not configured";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
