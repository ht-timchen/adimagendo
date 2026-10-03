import assert from "node:assert/strict";
import test from "node:test";
import { ageAtDate } from "./age-at-date";
import { parseRedcapDate, parseRedcapDob } from "./parse-redcap-date";

const dob = parseRedcapDob("2008-04-28");

function ageAtSignature(signedAt: string): number {
  assert.ok(dob);
  const reference = parseRedcapDate(signedAt);
  assert.ok(reference);
  return ageAtDate(dob, reference);
}

test("18th birthday, 08:00 Adelaide (previous day in UTC) is already 18", () => {
  assert.equal(ageAtSignature("2026-04-28 08:00:00"), 18);
});

test("the evening before the 18th birthday, 23:00 Adelaide, is still 17", () => {
  assert.equal(ageAtSignature("2026-04-27 23:00:00"), 17);
});

test("18th birthday, 18:54 Adelaide is 18", () => {
  assert.equal(ageAtSignature("2026-04-28 18:54:24"), 18);
});

test("Adelaide midnight on the birthday is 18", () => {
  assert.equal(ageAtSignature("2026-04-28 00:00:00"), 18);
});

test("a later month and an earlier month in the same year", () => {
  assert.equal(ageAtSignature("2026-09-01 10:00:00"), 18);
  assert.equal(ageAtSignature("2026-01-15 10:00:00"), 17);
});

test("result does not depend on the server timezone", () => {
  const original = process.env.TZ;
  try {
    for (const tz of ["UTC", "Australia/Adelaide", "America/Los_Angeles"]) {
      process.env.TZ = tz;
      assert.equal(ageAtSignature("2026-04-28 08:00:00"), 18, tz);
      assert.equal(ageAtSignature("2026-04-27 23:00:00"), 17, tz);
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
