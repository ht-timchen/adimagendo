import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { isStaffUser } from "@/lib/admin-people";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });

  if (!user || !isStaffUser(user.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.user.update({
      where: { id },
      data: { isActive: true },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH activate:", e);
    return NextResponse.json({ error: "Failed to activate" }, { status: 500 });
  }
}
