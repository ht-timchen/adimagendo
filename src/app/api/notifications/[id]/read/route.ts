import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isLevelCompleteNotificationType } from "@/lib/checklist/level-complete-notifications";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const notification = await prisma.notification.findFirst({
    where: {
      id,
      userId: session.user.id,
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
