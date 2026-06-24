import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  hasPermission,
  isAdminDashboardRole,
  type AdminPermission,
} from "@/lib/admin-rbac";

export async function ensureAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isAdminDashboardRole(session)) redirect("/dashboard");
  return session;
}

export async function requirePermissionOrRedirect(permission: AdminPermission) {
  const session = await ensureAdmin();
  if (!hasPermission(session, permission)) {
    redirect("/dashboard/admin");
  }
  return session;
}

export async function ensurePeopleReadAccess() {
  return requirePermissionOrRedirect("admin_user:read");
}

export async function ensurePeopleWriteAccess() {
  return requirePermissionOrRedirect("admin_user:update");
}

export async function ensureRoleManageAccess() {
  return requirePermissionOrRedirect("role:manage");
}
