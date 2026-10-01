import assert from "node:assert/strict";
import test from "node:test";
import { generateTemporaryPassword } from "../admin-people";

test("temporary password has the requested length and only readable characters", () => {
  const pw = generateTemporaryPassword(20);
  assert.equal(pw.length, 20);
  assert.match(pw, /^[abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
});

test("temporary passwords differ between calls", () => {
  assert.notEqual(generateTemporaryPassword(), generateTemporaryPassword());
});
