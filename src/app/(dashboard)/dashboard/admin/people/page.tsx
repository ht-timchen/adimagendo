import Link from "next/link";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { lastActiveTimestamp } from "@/lib/admin-display";
import { displayPeopleRole } from "@/lib/admin-people";
import { canAssignStaffRoles, ensureAdmin } from "@/lib/people-admin-auth";
import { isSmtpConfigured } from "@/lib/mail";
import { PeopleManagement, type PeopleRow } from "@/components/admin/people-management";

export default async function AdminPeoplePage() {
  const session = await ensureAdmin();
  const isSuperAdmin =
    session?.user?.id && session.user.email
      ? await canAssignStaffRoles(session.user.id, session.user.email, session.user.role)
      : false;

  const users = await prisma.user.findMany({
    where: { role: { in: [Role.USER, Role.ADMIN] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      superAdmin: true,
      isActive: true,
    },
  });

  const people: PeopleRow[] = await Promise.all(
    users.map(async (u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: displayPeopleRole(u),
      isActive: u.isActive,
      lastActive: (await lastActiveTimestamp(u.id))?.toISOString() ?? null,
    }))
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <Link
          href="/dashboard/admin"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          ← Back to overview
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">People</h1>
        <p className="mt-1 text-sm text-slate-600">
          Invite staff, manage roles, and control access. Share credentials by email or copy a temporary
          password manually.
        </p>
      </div>

      <PeopleManagement
        people={people}
        isSuperAdmin={isSuperAdmin}
        currentUserId={session?.user?.id ?? ""}
        emailDeliveryAvailable={isSmtpConfigured()}
      />
    </div>
  );
}
