import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveEnrolmentRowState,
  replaceLinkConfirmation,
  rowPrimaryAction,
  rowStatusPresentation,
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

test("status wording", () => {
  assert.deepEqual(rowStatusPresentation({ kind: "no-link" }), { label: "No enrolment link", tone: "none" });
  assert.deepEqual(rowStatusPresentation({ kind: "link-active", expiresAt: "x" }), { label: "Enrolment link active", tone: "success" });
  assert.deepEqual(rowStatusPresentation({ kind: "link-expired" }), { label: "Enrolment link expired", tone: "muted" });
  assert.deepEqual(rowStatusPresentation({ kind: "registered" }), { label: "Registered", tone: "accent" });
  assert.deepEqual(rowStatusPresentation({ kind: "deactivated" }), { label: "Account deactivated", tone: "danger" });
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
