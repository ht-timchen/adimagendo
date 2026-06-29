import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { deriveTokenStatus } from "@/lib/admin/participant-detail-status";

const ROUTE_PATH = "src/app/api/admin/enrolment-token/route.ts";
const CLIENT_PATH = "src/app/(dashboard)/dashboard/admin/actions/enrolment/EnrolmentClient.tsx";
const ROW_ACTIONS_PATH = "src/components/admin/participant-row-actions.tsx";

async function readSource(path: string): Promise<string> {
  return readFile(new URL(`../../../${path}`, import.meta.url), "utf8");
}

describe("enrolment token regeneration contract", () => {
  it("creates a new 64-char token with ~30 day expiry", async () => {
    const source = await readSource(ROUTE_PATH);

    assert.match(source, /randomBytes\(32\)\.toString\("hex"\)/);
    assert.match(source, /expiresAt\.setDate\(expiresAt\.getDate\(\) \+ 30\)/);
  });

  it("regeneration delete predicate removes only unused active tokens", async () => {
    const source = await readSource(ROUTE_PATH);

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

  it("admin enrolment dashboard aggregation prioritizes used > active > expired > none", async () => {
    const source = await readSource(CLIENT_PATH);

    const usedIndex = source.indexOf('if (relevant.some((t) => t.status === "used"))');
    const activeIndex = source.indexOf('if (relevant.some((t) => t.status === "active"))');
    const expiredIndex = source.indexOf('if (relevant.some((t) => t.status === "expired"))');

    assert.ok(usedIndex > -1, "missing used-priority check");
    assert.ok(activeIndex > -1, "missing active-priority check");
    assert.ok(expiredIndex > -1, "missing expired-priority check");
    assert.ok(usedIndex < activeIndex, "used should be prioritized before active");
    assert.ok(activeIndex < expiredIndex, "active should be prioritized before expired");
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
