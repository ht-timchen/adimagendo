import Link from "next/link";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { displayPeopleRole } from "@/lib/admin-people";
import { requirePermissionOrRedirect } from "@/lib/people-admin-auth";
import { hasPermission } from "@/lib/admin-rbac";
import { isSmtpConfigured } from "@/lib/mail";
import { PeopleManagement, type PeopleRow } from "@/components/admin/people-management";

export default async function AdminPeoplePage() {
  const session = await requirePermissionOrRedirect("admin_user:read");
  const canManageStaff = hasPermission(session, "admin_user:update");
  const canManageRoles = hasPermission(session, "role:manage");

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
      lastLoginAt: true,
    },
  });

  const people: PeopleRow[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: displayPeopleRole(u),
      isActive: u.isActive,
      lastActive: u.lastLoginAt?.toISOString() ?? null,
    }));

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

      {canManageStaff ? (
        <PeopleManagement
          people={people}
          isSuperAdmin={canManageRoles}
          currentUserId={session?.user?.id ?? ""}
          emailDeliveryAvailable={isSmtpConfigured()}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last active</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{person.name ?? "—"}</td>
                  <td className="px-4 py-3">{person.email}</td>
                  <td className="px-4 py-3">{person.role}</td>
                  <td className="px-4 py-3">
                    {person.isActive ? "Active" : "Inactive"}
                  </td>
                  <td className="px-4 py-3">
                    {person.lastActive
                      ? new Date(person.lastActive).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
