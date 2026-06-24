import type { Session } from "next-auth";

export type AdminDashboardRole = "USER" | "ADMIN" | "SUPER_ADMIN";

export type AdminPermission =
  | "overview:read"
  | "participant:read"
  | "participant:update"
  | "participant:reset_password"
  | "participant:mark_pilot"
  | "checklist:read"
  | "checklist:update"
  | "post:read"
  | "post:update"
  | "contact_message:read"
  | "contact_message:reply"
  | "notification:send"
  | "notification:broadcast"
  | "symptom_diary:export"
  | "redcap:sync"
  | "admin_user:read"
  | "admin_user:create"
  | "admin_user:update"
  | "admin_user:delete"
  | "admin_user:reset_password"
  | "role:manage"
  | "settings:read"
  | "settings:manage"
  | "audit_log:read"
  | "import:manage"
  | "enrolment:manage";

const USER_PERMISSIONS: ReadonlySet<AdminPermission> = new Set([
  "overview:read",
  "participant:read",
  "checklist:read",
  "post:read",
  "contact_message:read",
]);

const ADMIN_PERMISSIONS: ReadonlySet<AdminPermission> = new Set([
  ...USER_PERMISSIONS,
  "participant:update",
  "participant:reset_password",
  "checklist:update",
  "post:update",
  "contact_message:reply",
  "notification:send",
  "symptom_diary:export",
  "redcap:sync",
  "admin_user:read",
  "enrolment:manage",
]);

const ALL_PERMISSIONS: ReadonlySet<AdminPermission> = new Set([
  ...ADMIN_PERMISSIONS,
  "participant:mark_pilot",
  "notification:broadcast",
  "admin_user:create",
  "admin_user:update",
  "admin_user:delete",
  "admin_user:reset_password",
  "role:manage",
  "settings:read",
  "settings:manage",
  "audit_log:read",
  "import:manage",
  "enrolment:manage",
]);

const ROLE_PERMISSIONS: Record<AdminDashboardRole, ReadonlySet<AdminPermission>> = {
  USER: USER_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  SUPER_ADMIN: ALL_PERMISSIONS,
};

export function sessionRole(session: Session | null | undefined): string | null {
  const role = session?.user?.role;
  return typeof role === "string" ? role : null;
}

function parseAdminDashboardRole(role: string | null): AdminDashboardRole | null {
  if (role === "USER" || role === "ADMIN" || role === "SUPER_ADMIN") {
    return role;
  }
  return null;
}

export function isAdminDashboardRole(
  roleOrSession: string | Session | null | undefined
): boolean {
  const role =
    typeof roleOrSession === "string"
      ? roleOrSession
      : sessionRole(roleOrSession);
  return parseAdminDashboardRole(role) !== null;
}

export function hasPermission(
  roleOrSession: string | Session | null | undefined,
  permission: AdminPermission
): boolean {
  const role =
    typeof roleOrSession === "string"
      ? roleOrSession
      : sessionRole(roleOrSession);
  const adminRole = parseAdminDashboardRole(role);
  if (!adminRole) return false;
  return ROLE_PERMISSIONS[adminRole].has(permission);
}

