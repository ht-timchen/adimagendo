import assert from "node:assert/strict";
import test from "node:test";
import { MIN_ADMIN_PASSWORD_LENGTH, validateNewAdminPassword } from "./admin-password";

test("rejects a missing password", () => {
  assert.ok(validateNewAdminPassword(undefined));
  assert.ok(validateNewAdminPassword(""));
});

test("rejects a password shorter than the minimum", () => {
  assert.ok(validateNewAdminPassword("a".repeat(MIN_ADMIN_PASSWORD_LENGTH - 1)));
});

test("rejects the known seed password, even when padded", () => {
  assert.ok(validateNewAdminPassword("imagendoadmin"));
  assert.ok(validateNewAdminPassword("xxxxImagendoAdminxxxx"));
});

test("accepts a long password that is not the seed default", () => {
  assert.equal(validateNewAdminPassword("k7Vq-synthetic-test-pw-93"), null);
});
