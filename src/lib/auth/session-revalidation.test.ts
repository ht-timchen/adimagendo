import assert from "node:assert/strict";
import test from "node:test";
import {
  refreshTokenFromDatabase,
  revalidateToken,
  type SessionUserRow,
} from "./session-revalidation";

const adminToken = {
  id: "u1",
  email: "staff@example.test",
  role: "ADMIN",
  active: true,
  superAdmin: false,
  iat: 1,
};

const row = (overrides: Partial<SessionUserRow> = {}): SessionUserRow => ({
  email: "staff@example.test",
  role: "ADMIN",
  isActive: true,
  superAdmin: false,
  sessionsRevokedAt: null,
  ...overrides,
});

test("an unchanged active staff user keeps the same session", () => {
  assert.deepEqual(revalidateToken(adminToken, row()), adminToken);
});

test("a deactivated admin ends the session", () => {
  assert.equal(revalidateToken(adminToken, row({ isActive: false })), null);
});

test("a deactivated super admin ends the session", () => {
  const token = { ...adminToken, role: "SUPER_ADMIN", superAdmin: true };
  assert.equal(
    revalidateToken(token, row({ isActive: false, superAdmin: true })),
    null
  );
});

test("a deleted user ends the session", () => {
  assert.equal(revalidateToken(adminToken, null), null);
});

test("a super admin demoted to admin loses super admin rights at once", () => {
  const token = { ...adminToken, role: "SUPER_ADMIN", superAdmin: true };
  const next = revalidateToken(token, row({ role: "ADMIN", superAdmin: false }));
  assert.equal(next?.role, "ADMIN");
  assert.equal(next?.superAdmin, false);
});

test("an admin demoted to user gets the user role", () => {
  assert.equal(revalidateToken(adminToken, row({ role: "USER" }))?.role, "USER");
});

test("an admin promoted to super admin is picked up", () => {
  const next = revalidateToken(adminToken, row({ superAdmin: true }));
  assert.equal(next?.role, "SUPER_ADMIN");
  assert.equal(next?.superAdmin, true);
});

test("an email change is picked up and other token fields are kept", () => {
  const next = revalidateToken(adminToken, row({ email: "new@example.test" }));
  assert.equal(next?.email, "new@example.test");
  assert.equal(next?.id, "u1");
  assert.equal((next as { iat?: number }).iat, 1);
});

test("a deactivated participant keeps the token, marked inactive", () => {
  const token = { id: "p1", email: "p@example.test", role: "PARTICIPANT", active: true, superAdmin: false };
  const next = revalidateToken(
    token,
    row({ email: "p@example.test", role: "PARTICIPANT", isActive: false })
  );
  assert.ok(next);
  assert.equal(next.active, false);
  assert.equal(next.role, "PARTICIPANT");
});

test("a deleted participant ends the session", () => {
  assert.equal(revalidateToken({ id: "p1", role: "PARTICIPANT" }, null), null);
});

test("refresh loads the user by the token id", async () => {
  let asked = "";
  const next = await refreshTokenFromDatabase(adminToken, async (id) => {
    asked = id;
    return row({ role: "USER" });
  });
  assert.equal(asked, "u1");
  assert.equal(next?.role, "USER");
});

test("a failing lookup keeps the existing token and logs no personal data", async () => {
  const logged: unknown[] = [];
  const failure = Object.assign(
    new Error("lookup for staff@example.test and id u1 failed"),
    { code: "P1008" }
  );
  const next = await refreshTokenFromDatabase(
    adminToken,
    async () => {
      throw failure;
    },
    (...args) => logged.push(args)
  );
  assert.equal(next, adminToken);
  assert.equal(logged.length, 1);
  const text = JSON.stringify(logged);
  assert.ok(!text.includes("staff@example.test"));
  assert.ok(!text.includes("u1"));
  assert.ok(text.includes("P1008"));
});

test("a token without an id is left alone and the database is not queried", async () => {
  let queried = false;
  const token = { email: "x@example.test" };
  const next = await refreshTokenFromDatabase(token, async () => {
    queried = true;
    return null;
  });
  assert.equal(next, token);
  assert.equal(queried, false);
});

// --- session revocation after an admin password reset ---------------------------------

const REVOKED_AT = new Date("2026-10-05T03:00:00.000Z");
const BEFORE = REVOKED_AT.getTime() - 60_000; // signed in a minute before the reset
const AFTER = REVOKED_AT.getTime() + 60_000; // signed in a minute after the reset
const participantToken = { id: "p1", email: "p@example.test", role: "PARTICIPANT", active: true, superAdmin: false };
const participantRow = (overrides: Partial<SessionUserRow> = {}) =>
  row({ email: "p@example.test", role: "PARTICIPANT", ...overrides });

for (const [who, baseToken, makeRow] of [
  ["staff", adminToken, row],
  ["participant", participantToken, participantRow],
] as const) {
  test(`${who}: nothing revoked, so a token with or without authTime keeps the session (deploy logs nobody out)`, () => {
    assert.ok(revalidateToken({ ...baseToken, authTime: BEFORE }, makeRow()));
    assert.ok(revalidateToken({ ...baseToken }, makeRow()));
  });

  test(`${who}: signed in before the reset ends the session`, () => {
    assert.equal(revalidateToken({ ...baseToken, authTime: BEFORE }, makeRow({ sessionsRevokedAt: REVOKED_AT })), null);
  });

  test(`${who}: a token without authTime ends the session once a reset has happened`, () => {
    assert.equal(revalidateToken({ ...baseToken }, makeRow({ sessionsRevokedAt: REVOKED_AT })), null);
  });

  test(`${who}: signing in again after the reset keeps the session`, () => {
    const kept = revalidateToken({ ...baseToken, authTime: AFTER }, makeRow({ sessionsRevokedAt: REVOKED_AT }));
    assert.ok(kept);
    assert.equal(kept.authTime, AFTER, "authTime must survive revalidation unchanged");
  });
}

test("a sign-in at the very same millisecond as the reset is kept", () => {
  assert.ok(revalidateToken({ ...adminToken, authTime: REVOKED_AT.getTime() }, row({ sessionsRevokedAt: REVOKED_AT })));
});

test("a revoked session ends even for a deactivated participant (revocation is checked first)", () => {
  assert.equal(
    revalidateToken(
      { ...participantToken, authTime: BEFORE },
      participantRow({ isActive: false, sessionsRevokedAt: REVOKED_AT })
    ),
    null
  );
});

test("a revocation only affects the user it was written for", async () => {
  const revokedUser = row({ sessionsRevokedAt: REVOKED_AT });
  const otherUser = row();
  assert.equal(await refreshTokenFromDatabase({ ...adminToken, authTime: BEFORE }, async () => revokedUser), null);
  assert.ok(await refreshTokenFromDatabase({ ...adminToken, authTime: BEFORE }, async () => otherUser));
});
