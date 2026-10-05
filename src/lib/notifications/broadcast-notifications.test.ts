import assert from "node:assert/strict";
import test from "node:test";
import type { Session } from "next-auth";
import { hasPermission } from "@/lib/admin-rbac";
import {
  BROADCAST_BODY_MAX,
  BROADCAST_PUSH_URL,
  buildBroadcastPushPayload,
  BROADCAST_TITLE_MAX,
  broadcastResultMessage,
  type BroadcastPushSummary,
  formatUnreadBadge,
  isParticipantReadableNotificationType,
  notificationsLinkAriaLabel,
  validateBroadcastInput,
} from "./broadcast-notifications";

const ID = "3f2a9c1e-7b64-4d0a-9a55-0c1d2e3f4a5b";
const asSession = (role: string): Session =>
  ({ user: { id: "u", role, superAdmin: role === "SUPER_ADMIN" }, expires: "" }) as unknown as Session;

test("only a super admin may broadcast; ADMIN and USER may not", () => {
  assert.equal(hasPermission(asSession("SUPER_ADMIN"), "notification:broadcast"), true);
  assert.equal(hasPermission(asSession("ADMIN"), "notification:broadcast"), false);
  assert.equal(hasPermission(asSession("USER"), "notification:broadcast"), false);
  assert.equal(hasPermission(asSession("PARTICIPANT"), "notification:broadcast"), false);
});

test("validation rejects a blank title, however it is blank", () => {
  for (const title of ["", "   ", "\n\t ", undefined, null, 42]) {
    const result = validateBroadcastInput({ title, body: "x", submissionId: ID });
    assert.equal(result.ok, false, JSON.stringify(title));
  }
});

test("validation trims, and an empty message becomes null", () => {
  const result = validateBroadcastInput({ title: "  Hello  ", body: "   ", submissionId: ID });
  assert.deepEqual(result, { ok: true, input: { title: "Hello", body: null, submissionId: ID } });
});

test("validation keeps line breaks inside the message", () => {
  const result = validateBroadcastInput({ title: "t", body: "line 1\nline 2", submissionId: ID });
  assert.ok(result.ok);
  assert.equal(result.input.body, "line 1\nline 2");
});

test("validation enforces length limits and a well-formed submission id", () => {
  assert.equal(validateBroadcastInput({ title: "x".repeat(BROADCAST_TITLE_MAX + 1), submissionId: ID }).ok, false);
  assert.equal(validateBroadcastInput({ title: "t", body: "x".repeat(BROADCAST_BODY_MAX + 1), submissionId: ID }).ok, false);
  assert.equal(validateBroadcastInput({ title: "x".repeat(BROADCAST_TITLE_MAX), body: "x".repeat(BROADCAST_BODY_MAX), submissionId: ID }).ok, true);
  for (const submissionId of [undefined, "", "short", "has spaces in it!!", "x".repeat(65)]) {
    assert.equal(validateBroadcastInput({ title: "t", submissionId }).ok, false, String(submissionId));
  }
  assert.equal(validateBroadcastInput(null).ok, false);
  assert.equal(validateBroadcastInput("text").ok, false);
});

test("result messages state what was created and never claim anyone received or read it", () => {
  assert.deepEqual(broadcastResultMessage({ status: "created", count: 12 }), {
    tone: "success",
    text: "Notification created for 12 active participants.",
  });
  assert.equal(broadcastResultMessage({ status: "created", count: 1 }).text, "Notification created for 1 active participant.");
  assert.deepEqual(broadcastResultMessage({ status: "no-recipients" }), {
    tone: "info",
    text: "No active participants to notify.",
  });
  assert.match(broadcastResultMessage({ status: "replayed", count: 3 }).text, /already been sent, so nothing was added/);
  for (const outcome of [{ status: "created", count: 5 }, { status: "replayed", count: 5 }] as const) {
    assert.doesNotMatch(broadcastResultMessage(outcome).text, /\b(read|received|delivered|sent to)\b/i);
  }
});

test("unread badge and label", () => {
  assert.equal(formatUnreadBadge(0), null);
  assert.equal(formatUnreadBadge(-2), null);
  assert.equal(formatUnreadBadge(3), "3");
  assert.equal(formatUnreadBadge(9), "9");
  assert.equal(formatUnreadBadge(10), "9+");
  assert.equal(notificationsLinkAriaLabel(0), "Notifications");
  assert.equal(notificationsLinkAriaLabel(4), "Notifications – 4 unread");
  assert.equal(notificationsLinkAriaLabel(40), "Notifications – 9+ unread");
});

test("a participant may mark Level completion messages and broadcasts as read, nothing else", () => {
  for (const type of ["level_1_complete", "level_2_complete", "level_3_complete", "admin_broadcast"]) {
    assert.equal(isParticipantReadableNotificationType(type), true, type);
  }
  for (const type of ["admin_push", "appointment", "survey", "", null, undefined]) {
    assert.equal(isParticipantReadableNotificationType(type), false, String(type));
  }
});

test("the phone push carries the title only and opens the notifications page", () => {
  assert.deepEqual(buildBroadcastPushPayload("Clinic closed Friday"), {
    title: " ",
    body: "Clinic closed Friday",
    url: BROADCAST_PUSH_URL,
  });
  assert.equal(BROADCAST_PUSH_URL, "/dashboard/notifications");
  assert.ok(!JSON.stringify(buildBroadcastPushPayload("t")).includes("Line two"), "message text is never in the push");
});

test("result message reports the push separately and honestly", () => {
  const created = (push: BroadcastPushSummary) =>
    broadcastResultMessage({ status: "created", count: 12, push });

  assert.deepEqual(created({ state: "sent", devices: 7, failed: 0, recipientsWithoutPush: 5 }), {
    tone: "success",
    text: "Notification created for 12 active participants. Phone push sent to 7 devices; 5 participants haven't turned on push.",
  });
  assert.equal(
    created({ state: "sent", devices: 1, failed: 0, recipientsWithoutPush: 1 }).text,
    "Notification created for 12 active participants. Phone push sent to 1 device; 1 participant hasn't turned on push."
  );
  assert.equal(
    created({ state: "sent", devices: 12, failed: 0, recipientsWithoutPush: 0 }).text,
    "Notification created for 12 active participants. Phone push sent to 12 devices."
  );
  assert.match(created({ state: "sent", devices: 0, failed: 0, recipientsWithoutPush: 12 }).text, /No participant has turned on phone push yet/);
  const partial = created({ state: "sent", devices: 6, failed: 2, recipientsWithoutPush: 0 });
  assert.equal(partial.tone, "warning");
  assert.match(partial.text, /2 devices could not be reached/);
  assert.equal(created({ state: "sent", devices: 0, failed: 3, recipientsWithoutPush: 0 }).tone, "warning");
  assert.equal(created({ state: "not-configured" }).tone, "warning");
  assert.match(created({ state: "not-configured" }).text, /^Notification created for 12 active participants\. Phone push could not be sent/);
  assert.match(created({ state: "failed" }).text, /in-app notifications are in place/);
  for (const push of [
    { state: "sent", devices: 7, failed: 0, recipientsWithoutPush: 5 },
    { state: "sent", devices: 6, failed: 2, recipientsWithoutPush: 0 },
  ] as const) {
    assert.doesNotMatch(created(push).text, /\b(delivered|received|read)\b/i);
  }
  assert.equal(broadcastResultMessage({ status: "created", count: 3 }).text, "Notification created for 3 active participants.");
});
