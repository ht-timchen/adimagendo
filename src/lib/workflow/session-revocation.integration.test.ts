import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { assertTestDatabase } from "@/lib/test-support/assert-test-database";
import { sessionRevocationData } from "@/lib/auth/session-revocation";
import { revalidateToken } from "@/lib/auth/session-revalidation";

assertTestDatabase();

/**
 * Real Prisma + test.db: the helper really writes the column, the stored value really
 * ends an older session, and it leaves other users and later sign-ins alone.
 * Synthetic data only; every row uses this run's unique prefix.
 */
const PREFIX = `revoke-${process.pid}-${Date.now()}`;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function createUser(name: string) {
  return prisma.user.create({
    data: { email: `${PREFIX}-${name}@example.test`, name, role: "PARTICIPANT", passwordHash: "old-hash" },
  });
}

async function loadRow(id: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id },
    select: { email: true, role: true, isActive: true, superAdmin: true, sessionsRevokedAt: true },
  });
}

const tokenFor = (user: { id: string; email: string }, authTime: number) => ({
  id: user.id,
  email: user.email,
  role: "PARTICIPANT",
  active: true,
  superAdmin: false,
  authTime,
});

after(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("password reset revokes older sessions (real database)", () => {
  it("a new column value is null by default, so existing users are untouched", async () => {
    const user = await createUser("fresh");
    const row = await loadRow(user.id);
    assert.equal(row.sessionsRevokedAt, null);
    assert.ok(revalidateToken(tokenFor(user, Date.now()), row));
  });

  it("an update using the helper stores the time and ends the older session only", async () => {
    const target = await createUser("target");
    const bystander = await createUser("bystander");
    const signedInBefore = Date.now();
    await pause(5);

    const before = Date.now();
    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash: "new-hash", ...sessionRevocationData() },
    });
    const after = Date.now();

    const row = await loadRow(target.id);
    assert.ok(row.sessionsRevokedAt, "sessionsRevokedAt must be written");
    assert.ok(row.sessionsRevokedAt.getTime() >= before && row.sessionsRevokedAt.getTime() <= after);

    assert.equal(revalidateToken(tokenFor(target, signedInBefore), row), null, "older session ends");
    assert.equal(
      revalidateToken(tokenFor(bystander, signedInBefore), await loadRow(bystander.id)) === null,
      false,
      "another user's session is untouched"
    );

    await pause(5);
    assert.ok(revalidateToken(tokenFor(target, Date.now()), row), "signing in again after the reset works");
  });

  it("a second reset moves the cut-off forward", async () => {
    const user = await createUser("twice");
    await prisma.user.update({ where: { id: user.id }, data: { ...sessionRevocationData() } });
    await pause(5);
    const signedInBetween = Date.now();
    await pause(5);
    await prisma.user.update({ where: { id: user.id }, data: { ...sessionRevocationData() } });
    assert.equal(revalidateToken(tokenFor(user, signedInBetween), await loadRow(user.id)), null);
  });
});
