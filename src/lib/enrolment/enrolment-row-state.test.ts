import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveEnrolmentRowState,
  replaceLinkConfirmation,
  rowPrimaryAction,
  rowStatusPresentation,
  STATUS_COLUMN_HELP,
  STATUS_LEGEND,
  type RowStateToken,
} from "./enrolment-row-state";

const NOW = new Date("2026-10-05T03:00:00.000Z");
const day = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
const token = (overrides: Partial<RowStateToken> = {}): RowStateToken => ({
  usedAt: null,
  revokedAt: null,
  expiresAt: day(10),
  ...overrides,
});
const state = (account: { isActive: boolean } | null, tokens: RowStateToken[]) =>
  deriveEnrolmentRowState({ account, tokens, now: NOW });

test("no account and no token: no enrolment link", () => {
  assert.deepEqual(state(null, []), { kind: "no-link" });
});

test("an unused, unexpired token is an active link and carries its expiry", () => {
  assert.deepEqual(state(null, [token()]), { kind: "link-active", expiresAt: day(10).toISOString() });
});

test("an expired unused token is an expired link", () => {
  assert.deepEqual(state(null, [token({ expiresAt: day(-1) })]), { kind: "link-expired" });
});

test("a revoked token is not active", () => {
  assert.deepEqual(state(null, [token({ revokedAt: day(-1) })]), { kind: "link-revoked" });
});

test("with no account, an active link outranks a used one, then used, revoked, expired", () => {
  const used = token({ usedAt: day(-3) });
  const revoked = token({ revokedAt: day(-2) });
  const expired = token({ expiresAt: day(-5) });
  assert.equal(state(null, [used, token(), expired]).kind, "link-active");
  assert.equal(state(null, [expired, revoked, used]).kind, "link-used");
  assert.equal(state(null, [expired, revoked]).kind, "link-revoked");
  assert.equal(state(null, [expired]).kind, "link-expired");
});

test("a linked account decides the state whatever the tokens say", () => {
  assert.equal(state({ isActive: true }, []).kind, "registered");
  assert.equal(state({ isActive: true }, [token({ usedAt: day(-1) })]).kind, "registered");
  assert.equal(state({ isActive: true }, [token()]).kind, "registered", "a stray active link must not show");
  assert.equal(state({ isActive: false }, [token({ usedAt: day(-1) })]).kind, "deactivated");
});

test("the expiry shown is the one of the link that is actually usable", () => {
  const later = token({ expiresAt: day(20) });
  const sooner = token({ expiresAt: day(5) });
  assert.deepEqual(state(null, [sooner, later]), { kind: "link-active", expiresAt: day(20).toISOString() });
});

test("status wording: one column, and only registration and access", () => {
  assert.deepEqual(rowStatusPresentation({ kind: "link-active", expiresAt: "x" }), { label: "Pending", tone: "success" });
  assert.deepEqual(rowStatusPresentation({ kind: "registered" }), { label: "Registered", tone: "accent" });
  assert.deepEqual(rowStatusPresentation({ kind: "deactivated" }), { label: "Deactivated", tone: "danger" });
});

test("no link, an expired link and any other lapsed link all show a dash", () => {
  for (const kind of ["no-link", "link-expired", "link-revoked", "link-used"] as const) {
    assert.deepEqual(rowStatusPresentation({ kind }), { label: "-", tone: "none" }, kind);
  }
});

test("the status words never reuse the Participants page verb 'Activate'", () => {
  const labels = (["no-link", "link-expired", "link-revoked", "link-used", "registered", "deactivated"] as const)
    .map((kind) => rowStatusPresentation({ kind }).label)
    .concat(rowStatusPresentation({ kind: "link-active", expiresAt: "x" }).label);
  assert.ok(labels.every((label) => !/activate/i.test(label) || label === "Deactivated"));
});

test("the Status help text says what the column is not", () => {
  assert.equal(
    STATUS_COLUMN_HELP,
    "Shows Study Buddy registration and account access. This does not indicate study consent, withdrawal or study completion."
  );
  assert.deepEqual(STATUS_LEGEND.map((item) => item.label), ["Registered", "Pending", "Deactivated", "-"]);
});

test("the next action for each state", () => {
  assert.equal(rowPrimaryAction({ kind: "no-link" }), "generate");
  assert.equal(rowPrimaryAction({ kind: "link-expired" }), "generate");
  assert.equal(rowPrimaryAction({ kind: "link-revoked" }), "generate");
  assert.equal(rowPrimaryAction({ kind: "link-used" }), "generate");
  assert.equal(rowPrimaryAction({ kind: "link-active", expiresAt: "x" }), "copy");
  assert.equal(rowPrimaryAction({ kind: "registered" }), "view");
  assert.equal(rowPrimaryAction({ kind: "deactivated" }), "view");
});

test("a registered participant can never be offered a new link", () => {
  for (const kind of ["registered", "deactivated"] as const) {
    assert.notEqual(rowPrimaryAction({ kind }), "generate");
  }
});

test("replace confirmation names the participant and the consequence", () => {
  assert.equal(
    replaceLinkConfirmation("Alex Example", "27"),
    "Generate a new enrolment link for Alex Example (Record 27)? The current link will stop working."
  );
  assert.equal(
    replaceLinkConfirmation(null, "27"),
    "Generate a new enrolment link for Record 27? The current link will stop working."
  );
});
