import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { deriveTokenStatus } from "@/lib/admin/participant-detail-status";
import { deriveEnrolmentRowState } from "@/lib/enrolment/enrolment-row-state";

const SERVICE_PATH = "src/lib/enrolment/enrolment-token-service.ts";
const ROW_ACTIONS_PATH = "src/components/admin/participant-row-actions.tsx";

async function readSource(path: string): Promise<string> {
  return readFile(new URL(`../../../${path}`, import.meta.url), "utf8");
}

describe("enrolment token regeneration contract", () => {
  it("creates a new 64-char token with ~30 day expiry", async () => {
    const source = await readSource(SERVICE_PATH);

    assert.match(source, /randomBytes\(32\)\.toString\("hex"\)/);
    assert.match(source, /expiresAt\.setDate\(expiresAt\.getDate\(\) \+ 30\)/);
  });

  it("regeneration delete predicate removes only unused active tokens", async () => {
    const source = await readSource(SERVICE_PATH);

    assert.match(source, /deleteMany\(\{/);
    assert.match(source, /studyRecordId,/);
    assert.match(source, /usedAt:\s*null,/);
    assert.match(source, /expiresAt:\s*\{\s*gt:\s*now\s*\}/);
  });

  it("status derivation keeps used and expired semantics stable", () => {
    const now = new Date("2026-06-29T12:00:00.000Z");
    const past = new Date("2026-06-01T12:00:00.000Z");
    const future = new Date("2026-07-10T12:00:00.000Z");
    const usedAt = new Date("2026-06-20T12:00:00.000Z");

    assert.equal(deriveTokenStatus(usedAt, future, now), "used");
    assert.equal(deriveTokenStatus(null, past, now), "expired");
    assert.equal(deriveTokenStatus(null, future, now), "active");
  });

  it("admin enrolment dashboard status: a linked account wins, then active > used > revoked > expired > none", () => {
    const now = new Date("2026-06-29T12:00:00.000Z");
    const future = new Date("2026-07-10T12:00:00.000Z");
    const past = new Date("2026-06-01T12:00:00.000Z");
    const t = (o: { usedAt?: Date; revokedAt?: Date; expiresAt?: Date }) => ({
      usedAt: o.usedAt ?? null,
      revokedAt: o.revokedAt ?? null,
      expiresAt: o.expiresAt ?? future,
    });
    const kind = (account: { isActive: boolean } | null, tokens: ReturnType<typeof t>[]) =>
      deriveEnrolmentRowState({ account, tokens, now }).kind;

    assert.equal(kind({ isActive: true }, [t({ usedAt: past })]), "registered");
    assert.equal(kind({ isActive: false }, []), "deactivated");
    assert.equal(kind(null, [t({ usedAt: past }), t({})]), "link-active");
    assert.equal(kind(null, [t({ usedAt: past })]), "link-used");
    assert.equal(kind(null, [t({ revokedAt: past, expiresAt: past })]), "link-revoked");
    assert.equal(kind(null, [t({ expiresAt: past })]), "link-expired");
    assert.equal(kind(null, []), "no-link");
  });

  it("participant row actions reuses active link before generating new one", async () => {
    const source = await readSource(ROW_ACTIONS_PATH);

    const activeCheckIndex = source.indexOf(
      'const active = tokens.find((t) => t.status === "active" && t.token);'
    );
    const postIndex = source.indexOf('await fetch("/api/admin/enrolment-token", {');

    assert.ok(activeCheckIndex > -1, "missing active-token reuse check");
    assert.ok(postIndex > -1, "missing fallback generation call");
    assert.ok(activeCheckIndex < postIndex, "should check active token before POST generate");
  });
});
