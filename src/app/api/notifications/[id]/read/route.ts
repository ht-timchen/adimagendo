import { NextResponse } from "next/server";
import { requireParticipantApiSession } from "@/lib/participant-api-auth";
import { prisma } from "@/lib/db";
import { markNotificationRead } from "@/lib/notifications/broadcast-notifications";

/**
 * Mark one of the signed-in participant's own notifications as read: Level completion
 * messages and admin broadcasts. Another user's notification, an unknown id or any other
 * type answers 404. Marking an already-read notification is safe.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireParticipantApiSession();
  if (!authResult.ok) return authResult.response;
  const { userId } = authResult.ctx;

  const { id } = await params;
  const result = await markNotificationRead(prisma, { userId, notificationId: id });
  if (result === "not-found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
