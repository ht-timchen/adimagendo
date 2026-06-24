import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasPermission,
  isAdminDashboardRole,
  type AdminPermission,
} from "@/lib/admin-rbac";

const USER_READ_PERMISSIONS = [
  "overview:read",
  "participant:read",
  "checklist:read",
  "post:read",
  "contact_message:read",
] as const satisfies readonly AdminPermission[];

const USER_DENIED_PERMISSIONS = [
  "participant:update",
  "participant:reset_password",
  "checklist:update",
  "post:update",
  "contact_message:reply",
  "notification:send",
  "symptom_diary:export",
  "redcap:sync",
  "admin_user:read",
  "settings:manage",
] as const satisfies readonly AdminPermission[];

const ADMIN_EXTRA_PERMISSIONS = [
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
] as const satisfies readonly AdminPermission[];

const ADMIN_DENIED_PERMISSIONS = [
  "admin_user:create",
  "admin_user:update",
  "admin_user:delete",
  "admin_user:reset_password",
  "role:manage",
  "settings:manage",
  "import:manage",
  "participant:mark_pilot",
  "notification:broadcast",
] as const satisfies readonly AdminPermission[];

/** Canonical v1 permission list — must stay in sync with AdminPermission in admin-rbac.ts */
const ALL_DEFINED_PERMISSIONS = [
  ...USER_READ_PERMISSIONS,
  ...ADMIN_EXTRA_PERMISSIONS,
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
] as const satisfies readonly AdminPermission[];

const REMOVED_PLACEHOLDER_PERMISSIONS = [
  "export:manage",
  "participant:export",
  "participant:delete",
] as const;

function assertHas(role: string, permissions: readonly AdminPermission[]) {
  for (const permission of permissions) {
    assert.equal(
      hasPermission(role, permission),
      true,
      `${role} should have ${permission}`
    );
  }
}

function assertLacks(role: string, permissions: readonly AdminPermission[]) {
  for (const permission of permissions) {
    assert.equal(
      hasPermission(role, permission),
      false,
      `${role} should not have ${permission}`
    );
  }
}

describe("admin RBAC role classification", () => {
  it("treats USER, ADMIN, and SUPER_ADMIN as admin dashboard roles", () => {
    assert.equal(isAdminDashboardRole("USER"), true);
    assert.equal(isAdminDashboardRole("ADMIN"), true);
    assert.equal(isAdminDashboardRole("SUPER_ADMIN"), true);
  });

  it("does not treat PARTICIPANT as an admin dashboard role", () => {
    assert.equal(isAdminDashboardRole("PARTICIPANT"), false);
    assert.equal(isAdminDashboardRole(null), false);
    assert.equal(isAdminDashboardRole(undefined), false);
  });
});

describe("admin RBAC USER permissions", () => {
  it("grants read-only dashboard permissions", () => {
    assertHas("USER", USER_READ_PERMISSIONS);
  });

  it("denies mutation, export, sync, staff, and settings permissions", () => {
    assertLacks("USER", USER_DENIED_PERMISSIONS);
  });
});

describe("admin RBAC ADMIN permissions", () => {
  it("inherits all USER read permissions", () => {
    assertHas("ADMIN", USER_READ_PERMISSIONS);
  });

  it("grants operational permissions", () => {
    assertHas("ADMIN", ADMIN_EXTRA_PERMISSIONS);
  });

  it("denies super-admin-only permissions", () => {
    assertLacks("ADMIN", ADMIN_DENIED_PERMISSIONS);
  });
});

describe("admin RBAC SUPER_ADMIN permissions", () => {
  it("has every defined v1 permission", () => {
    assertHas("SUPER_ADMIN", ALL_DEFINED_PERMISSIONS);
  });
});

describe("admin RBAC removed placeholder permissions", () => {
  it("does not include removed permissions in the v1 permission list", () => {
    const defined = new Set<string>(ALL_DEFINED_PERMISSIONS);
    for (const removed of REMOVED_PLACEHOLDER_PERMISSIONS) {
      assert.equal(
        defined.has(removed),
        false,
        `${removed} should not be in the v1 permission list`
      );
    }
  });

  it("denies removed placeholder permissions for all admin dashboard roles", () => {
    for (const role of ["USER", "ADMIN", "SUPER_ADMIN"] as const) {
      for (const removed of REMOVED_PLACEHOLDER_PERMISSIONS) {
        assert.equal(
          hasPermission(role, removed as AdminPermission),
          false,
          `${role} should not have removed permission ${removed}`
        );
      }
    }
  });
});
