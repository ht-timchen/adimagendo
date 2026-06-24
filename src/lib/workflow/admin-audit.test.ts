import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Session } from "next-auth";
import { prisma } from "@/lib/db";
import {
  ADMIN_AUDIT_ACTIONS,
  recordAdminAuditEvent,
  snapshotActorFromSession,
} from "@/lib/admin-audit";

function mockSession(overrides: Partial<Session["user"]> & { id: string }): Session {
  return {
    user: {
      id: overrides.id,
      email: overrides.email ?? "staff@example.com",
      name: overrides.name ?? "Staff User",
      role: overrides.role ?? "ADMIN",
      superAdmin: overrides.superAdmin ?? false,
    },
    expires: new Date(Date.now() + 60_000).toISOString(),
  };
}

describe("admin audit actor snapshot", () => {
  it("stores actorUserId, actorName, and actorRole from session", () => {
    const session = mockSession({
      id: "user-123",
      name: "Jane Admin",
      email: "jane@example.com",
      role: "ADMIN",
      superAdmin: false,
    });

    const snapshot = snapshotActorFromSession(session);
    assert.equal(snapshot.actorUserId, "user-123");
    assert.equal(snapshot.actorName, "Jane Admin");
    assert.equal(snapshot.actorRole, "ADMIN");
  });

  it("snapshots SUPER_ADMIN when session.user.superAdmin is true", () => {
    const session = mockSession({
      id: "user-456",
      name: "",
      email: "super@example.com",
      role: "ADMIN",
      superAdmin: true,
    });

    const snapshot = snapshotActorFromSession(session);
    assert.equal(snapshot.actorName, "super@example.com");
    assert.equal(snapshot.actorRole, "SUPER_ADMIN");
  });
});

describe("admin audit recording", () => {
  it("does not throw when audit insert fails", async () => {
    const originalCreate = prisma.adminAuditEvent.create;
    prisma.adminAuditEvent.create = (async () => {
      throw new Error("simulated audit write failure");
    }) as typeof originalCreate;

    try {
      await assert.doesNotReject(async () => {
        await recordAdminAuditEvent({
          session: mockSession({ id: "actor-1" }),
          action: ADMIN_AUDIT_ACTIONS.STAFF_CREATED,
          targetType: "staff",
          targetId: "target-1",
          targetName: "New Staff",
        });
      });
    } finally {
      prisma.adminAuditEvent.create = originalCreate;
    }
  });
});
