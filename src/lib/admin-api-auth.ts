import { auth } from "@/auth";
import type { Session } from "next-auth";
import { hasPermission, isAdminDashboardRole, type AdminPermission } from "@/lib/admin-rbac";

export async function requireAdminSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!isAdminDashboardRole(session)) return null;
  return session;
}

export async function requirePermission(
  permission: AdminPermission
): Promise<Session | null> {
  const session = await requireAdminSession();
  if (!session) return null;
  return hasPermission(session, permission) ? session : null;
}
