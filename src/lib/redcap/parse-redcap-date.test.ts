import assert from "node:assert/strict";
import test from "node:test";
import { parseRedcapDate, parseRedcapDob } from "./parse-redcap-date";

const iso = (d: Date | null) => d?.toISOString() ?? null;

test("datetime during standard time (ACST +9:30) converts to UTC", () => {
  assert.equal(iso(parseRedcapDate("2026-04-28 18:54:24")), "2026-04-28T09:24:24.000Z");
});

test("datetime during daylight saving (ACDT +10:30) converts to UTC", () => {
  assert.equal(iso(parseRedcapDate("2026-10-09 11:37")), "2026-10-09T01:07:00.000Z");
});

test("date-only value means Adelaide midnight", () => {
  assert.equal(iso(parseRedcapDate("2026-04-28")), "2026-04-27T14:30:00.000Z");
});

test("T separator is accepted", () => {
  assert.equal(iso(parseRedcapDate("2026-04-28T18:54:24")), "2026-04-28T09:24:24.000Z");
});

test("an evening signature keeps the same Adelaide calendar day", () => {
  // The original bug: 18:54 Adelaide was stored as 18:54Z, which is 04:24 the next Adelaide day.
  const stored = parseRedcapDate("2026-04-28 18:54:24");
  assert.ok(stored);
  assert.ok(stored.getTime() < Date.parse("2026-04-28T14:30:00.000Z"));
});

test("empty and malformed values return null", () => {
  assert.equal(parseRedcapDate(""), null);
  assert.equal(parseRedcapDate("   "), null);
  assert.equal(parseRedcapDate("abc"), null);
  assert.equal(parseRedcapDate("28/04/2026"), null);
});

test("impossible calendar values return null instead of rolling over", () => {
  assert.equal(parseRedcapDate("2026-13-01 10:00"), null);
  assert.equal(parseRedcapDate("2026-02-31 10:00"), null);
  assert.equal(parseRedcapDate("2026-04-28 25:00"), null);
  assert.equal(parseRedcapDate("2026-04-28 10:61"), null);
});

test("DoB keeps date-only UTC-midnight parsing, independent of Adelaide offset", () => {
  assert.equal(iso(parseRedcapDob("2006-05-01")), "2006-05-01T00:00:00.000Z");
  assert.equal(parseRedcapDob(""), null);
  assert.equal(parseRedcapDob("abc"), null);
});
