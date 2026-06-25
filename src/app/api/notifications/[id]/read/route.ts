import { NextResponse } from "next/server";
import { requireParticipantApiSession } from "@/lib/participant-api-auth";
import { prisma } from "@/lib/db";
import { isLevelCompleteNotificationType } from "@/lib/checklist/level-complete-notifications";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireParticipantApiSession();
  if (!authResult.ok) return authResult.response;
  const { userId } = authResult.ctx;

  const { id } = await params;
  const notification = await prisma.notification.findFirst({
    where: {
      id,
      userId: userId,
    },
    select: { id: true, type: true },
  });

  if (
    !notification ||
    !notification.type ||
    !isLevelCompleteNotificationType(notification.type)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.notification.update({
    where: { id },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}
