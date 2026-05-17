import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { PROTECTED_ADMIN_EMAIL, isStaffUser } from "@/lib/admin-people";

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
    select: { id: true, email: true, role: true },
  });

  if (!user || !isStaffUser(user.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (user.email.toLowerCase() === PROTECTED_ADMIN_EMAIL) {
    return NextResponse.json(
      { error: "This account cannot be deactivated." },
      { status: 403 }
    );
  }

  try {
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH deactivate:", e);
    return NextResponse.json({ error: "Failed to deactivate" }, { status: 500 });
  }
}
