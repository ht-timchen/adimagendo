import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/admin-api-auth";

export async function GET() {
  const session = await requirePermission("contact_message:read");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true, name: true } } },
  });

  return NextResponse.json(messages);
}
