import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Every place that writes a password hash must either end the user's older sessions
 * (spread sessionRevocationData() into the update) or be listed here with the reason it
 * does not need to. A new writer that is not listed fails this test, so nobody can add a
 * password reset that silently leaves old sessions alive (BUG-012).
 */
const REVOKES_SESSIONS: Record<string, number> = {
  // path -> minimum number of sessionRevocationData( calls
  "src/app/api/admin/participants/[id]/reset-password/route.ts": 1,
  // manual branch (writes the password) and email branch (sends a reset link)
  "src/app/api/admin/people/[id]/reset-password/route.ts": 2,
  "scripts/set-admin-password.ts": 1,
};

const NO_REVOCATION_NEEDED: Record<string, string> = {
  "src/auth.ts": "only reads the hash to check a sign-in",
  "src/app/api/admin/people/invite/route.ts": "creates a new account, so no earlier session exists",
  "src/lib/enrolment/register-via-token.ts": "creates a new account, so no earlier session exists",
  "prisma/seed.ts": "creates the local dev admin only when it does not exist",
  "src/app/api/auth/accept-invite/route.ts":
    "sets a password from an invite link; a pending link comes from a new account or from the " +
    "email-mode staff reset, which already revoked sessions when it was issued",
};

const ROOT = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".next", "migrations", ".git"]);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const relative = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");
const writers = ["src", "scripts", "prisma"]
  .flatMap((dir) => sourceFiles(path.join(ROOT, dir)))
  .filter((file) => fs.readFileSync(file, "utf8").includes("passwordHash"))
  .map(relative);

test("every file that touches passwordHash is classified", () => {
  const known = new Set([...Object.keys(REVOKES_SESSIONS), ...Object.keys(NO_REVOCATION_NEEDED)]);
  const unclassified = writers.filter((file) => !known.has(file));
  assert.deepEqual(
    unclassified,
    [],
    "New password write found. Spread sessionRevocationData() into the update if an admin " +
      "resets an existing account's password, then add the file to REVOKES_SESSIONS " +
      "(or to NO_REVOCATION_NEEDED with the reason)."
  );
});

for (const [file, minimum] of Object.entries(REVOKES_SESSIONS)) {
  test(`${file} ends older sessions (sessionRevocationData used at least ${minimum}x)`, () => {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    const calls = source.split("sessionRevocationData(").length - 1;
    assert.ok(calls >= minimum, `expected at least ${minimum} call(s), found ${calls}`);
    assert.ok(source.includes("session-revocation"), "must import the helper from lib/auth/session-revocation");
  });
}

test("the classification lists have no stale entries", () => {
  const missing = [...Object.keys(REVOKES_SESSIONS), ...Object.keys(NO_REVOCATION_NEEDED)].filter(
    (file) => !writers.includes(file)
  );
  assert.deepEqual(missing, [], "these files no longer mention passwordHash; remove them from the lists");
});
