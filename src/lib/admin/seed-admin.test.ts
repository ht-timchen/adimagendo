import assert from "node:assert/strict";
import test from "node:test";
import { generateSeedAdminPassword, planSeedAdmin } from "./seed-admin";

const fixed = () => "generated-pw";

test("skips when SEED_DEV_ADMIN is not set, whether or not the account exists", () => {
  assert.deepEqual(planSeedAdmin({}, false, fixed), { action: "skip" });
  assert.deepEqual(planSeedAdmin({}, true, fixed), { action: "skip" });
});

test("skips for any value other than exactly 1", () => {
  assert.deepEqual(planSeedAdmin({ SEED_DEV_ADMIN: "true" }, false, fixed), { action: "skip" });
  assert.deepEqual(planSeedAdmin({ SEED_DEV_ADMIN: "0" }, false, fixed), { action: "skip" });
});

test("keeps an existing account untouched, even when a password is provided", () => {
  assert.deepEqual(
    planSeedAdmin({ SEED_DEV_ADMIN: "1", SEED_DEV_ADMIN_PASSWORD: "new-value" }, true, fixed),
    { action: "keep" },
  );
});

test("creates with the provided password", () => {
  assert.deepEqual(
    planSeedAdmin({ SEED_DEV_ADMIN: "1", SEED_DEV_ADMIN_PASSWORD: "my-local-pw" }, false, fixed),
    { action: "create", password: "my-local-pw", generated: false },
  );
});

test("creates with a generated password when none is provided", () => {
  assert.deepEqual(planSeedAdmin({ SEED_DEV_ADMIN: "1" }, false, fixed), {
    action: "create",
    password: "generated-pw",
    generated: true,
  });
});

test("generated passwords are long and differ between calls", () => {
  const a = generateSeedAdminPassword();
  const b = generateSeedAdminPassword();
  assert.ok(a.length >= 16);
  assert.notEqual(a, b);
});
