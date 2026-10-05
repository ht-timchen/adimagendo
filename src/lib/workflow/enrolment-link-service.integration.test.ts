import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { assertTestDatabase } from "@/lib/test-support/assert-test-database";
import {
  issueEnrolmentToken,
  listEnrolmentTokens,
} from "@/lib/enrolment/enrolment-token-service";

assertTestDatabase();

/**
 * Real Prisma + test.db. Synthetic data only; every row uses this run's unique prefix.
 */
const PREFIX = `link-${process.pid}-${Date.now()}`;
const DAY = 24 * 60 * 60 * 1000;
const recordIds: string[] = [];
let counter = 0;

function newRecord(): string {
  const id = `${PREFIX}-${++counter}`;
  recordIds.push(id);
  return id;
}

function addToken(
  studyRecordId: string,
  overrides: { usedAt?: Date; revokedAt?: Date; expiresAt?: Date; name: string }
) {
  return prisma.enrolmentToken.create({
    data: {
      token: `${studyRecordId}-${overrides.name}`,
      studyRecordId,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 10 * DAY),
      usedAt: overrides.usedAt ?? null,
      revokedAt: overrides.revokedAt ?? null,
      createdBy: "integration-test",
    },
  });
}

after(async () => {
  await prisma.enrolmentToken.deleteMany({ where: { studyRecordId: { in: recordIds } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("issueEnrolmentToken (real database)", () => {
  it("refuses a record that already has an account and leaves its current link alone", async () => {
    const studyRecordId = newRecord();
    const owner = await prisma.user.create({
      data: { email: `${PREFIX}-owner@example.test`, name: "Owner", role: "PARTICIPANT", passwordHash: "x" },
    });
    await prisma.participantProfile.create({
      data: { userId: owner.id, studyRecordId, enrollmentDate: new Date(), dataSource: "REDCAP", dataKind: "TEST" },
    });
    const existing = await addToken(studyRecordId, { name: "existing-active" });

    const result = await issueEnrolmentToken(prisma, { studyRecordId, createdBy: "tester" });

    assert.deepEqual(result, { ok: false, code: "RECORD_BOUND" });
    const rows = await prisma.enrolmentToken.findMany({ where: { studyRecordId } });
    assert.equal(rows.length, 1, "no new token");
    assert.equal(rows[0]!.id, existing.id, "the existing link was not deleted");
  });

  it("creates a 30-day link for an unregistered record", async () => {
    const studyRecordId = newRecord();
    const before = Date.now();
    const result = await issueEnrolmentToken(prisma, { studyRecordId, createdBy: "tester" });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(result.token, /^[0-9a-f]{64}$/);
    const days = (result.expiresAt.getTime() - before) / DAY;
    assert.ok(days > 29.99 && days < 30.01, `expected about 30 days, got ${days}`);
    assert.equal(await prisma.enrolmentToken.count({ where: { studyRecordId } }), 1);
  });

  it("replaces the previous unused link but keeps a used one", async () => {
    const studyRecordId = newRecord();
    const used = await addToken(studyRecordId, { name: "used", usedAt: new Date(Date.now() - DAY) });
    const oldActive = await addToken(studyRecordId, { name: "old-active" });

    const result = await issueEnrolmentToken(prisma, { studyRecordId, createdBy: "tester" });
    assert.equal(result.ok, true);

    const ids = (await prisma.enrolmentToken.findMany({ where: { studyRecordId } })).map((t) => t.id);
    assert.ok(ids.includes(used.id), "used link kept");
    assert.ok(!ids.includes(oldActive.id), "previous active link replaced");
    assert.equal(ids.length, 2);
  });
});

describe("listEnrolmentTokens (real database)", () => {
  it("never includes the token in the overview list", async () => {
    const studyRecordId = newRecord();
    await addToken(studyRecordId, { name: "overview" });
    const rows = await listEnrolmentTokens(prisma, {});
    assert.ok(rows.length > 0);
    assert.ok(rows.every((row) => !("token" in row)), "no row may carry a token");
  });

  it("includes the token only for a still-usable link of the requested record", async () => {
    const studyRecordId = newRecord();
    await addToken(studyRecordId, { name: "usable" });
    await addToken(studyRecordId, { name: "used", usedAt: new Date(Date.now() - DAY) });
    await addToken(studyRecordId, { name: "expired", expiresAt: new Date(Date.now() - DAY) });
    await addToken(studyRecordId, { name: "revoked", revokedAt: new Date(Date.now() - DAY) });

    const rows = await listEnrolmentTokens(prisma, { studyRecordId });
    assert.equal(rows.length, 4);
    const withToken = rows.filter((row) => row.token);
    assert.equal(withToken.length, 1);
    assert.equal(withToken[0]!.token, `${studyRecordId}-usable`);
    assert.equal(withToken[0]!.status, "active");
    for (const row of rows.filter((r) => !r.token)) {
      assert.notEqual(row.status, "active");
    }
  });

  it("treats a revoked link as not active", async () => {
    const studyRecordId = newRecord();
    await addToken(studyRecordId, { name: "only-revoked", revokedAt: new Date(Date.now() - DAY) });
    const [row] = await listEnrolmentTokens(prisma, { studyRecordId });
    assert.equal(row!.status, "expired");
    assert.equal(row!.token, undefined);
  });
});
