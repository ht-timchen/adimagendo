import assert from "node:assert/strict";
import test from "node:test";
import { sessionRevocationData } from "./session-revocation";

test("uses the time it is given, as a Date", () => {
  const data = sessionRevocationData(Date.UTC(2026, 9, 5, 3, 0, 0));
  assert.ok(data.sessionsRevokedAt instanceof Date);
  assert.equal(data.sessionsRevokedAt.toISOString(), "2026-10-05T03:00:00.000Z");
});

test("defaults to Date.now() and nothing else", () => {
  const before = Date.now();
  const stamped = sessionRevocationData().sessionsRevokedAt.getTime();
  const after = Date.now();
  assert.ok(stamped >= before && stamped <= after);
});

test("returns only the sessionsRevokedAt field, so it can be spread into any update", () => {
  assert.deepEqual(Object.keys(sessionRevocationData(0)), ["sessionsRevokedAt"]);
});
