import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { parsePeopleRoleInput, isStaffUser, PROTECTED_ADMIN_EMAIL } from "@/lib/admin-people";
import { canAssignStaffRoles } from "@/lib/people-admin-auth";

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!target || !isStaffUser(target.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const data: {
      name?: string;
      role?: typeof Role.USER | typeof Role.ADMIN;
      superAdmin?: boolean;
    } = {};

    if (parsed.data.name !== undefined) {
      data.name = parsed.data.name.trim();
    }

    if (parsed.data.role !== undefined) {
      if (!(await canAssignStaffRoles(session.user.id, session.user.email, session.user.role))) {
        return NextResponse.json(
          { error: "Only super admins can change roles" },
          { status: 403 }
        );
      }
      const mapped = parsePeopleRoleInput(parsed.data.role);
      data.role = mapped.prismaRole;
      data.superAdmin = mapped.superAdmin;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        superAdmin: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("PATCH /api/admin/people/[id]:", e);
    return NextResponse.json({ error: "Failed to update person" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true },
  });

  if (!user || !isStaffUser(user.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (user.email.toLowerCase() === PROTECTED_ADMIN_EMAIL) {
    return NextResponse.json(
      { error: "This account cannot be deleted." },
      { status: 403 }
    );
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/admin/people/[id]:", e);
    return NextResponse.json({ error: "Failed to delete person" }, { status: 500 });
  }
}
