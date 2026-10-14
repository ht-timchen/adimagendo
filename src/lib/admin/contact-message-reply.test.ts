import assert from "node:assert/strict";
import test from "node:test";
import {
  BROADCAST_BODY_MAX,
  BROADCAST_TITLE_MAX,
  isParticipantReadableNotificationType,
  type BroadcastPushSummary,
} from "@/lib/notifications/broadcast-notifications";
import {
  contactReplyErrorStatus,
  contactReplyResultMessage,
  participantFirstName,
  validateContactReplyInput,
} from "@/lib/admin/contact-message-reply";

const SID = "a1b2c3d4-0000-4000-8000-000000000001";

test("a reply needs a title and a message within the broadcast limits", () => {
  assert.equal(validateContactReplyInput({ title: " ", body: "Hi", submissionId: SID }).ok, false);
  assert.equal(validateContactReplyInput({ title: "Hi", body: "  ", submissionId: SID }).ok, false);
  assert.equal(validateContactReplyInput({ title: "x".repeat(BROADCAST_TITLE_MAX + 1), body: "Hi", submissionId: SID }).ok, false);
  assert.equal(validateContactReplyInput({ title: "Hi", body: "x".repeat(BROADCAST_BODY_MAX + 1), submissionId: SID }).ok, false);
  assert.equal(validateContactReplyInput({ title: "Hi", body: "Hi", submissionId: "short" }).ok, false);
  assert.equal(validateContactReplyInput(null).ok, false);

  const ok = validateContactReplyInput({
    title: ` ${"t".repeat(BROADCAST_TITLE_MAX)} `,
    body: "Line one\nLine two ",
    submissionId: SID,
  });
  assert.deepEqual(ok, {
    ok: true,
    input: { title: "t".repeat(BROADCAST_TITLE_MAX), body: "Line one\nLine two", submissionId: SID },
  });
});

test("recipient fields in the request are dropped", () => {
  const parsed = validateContactReplyInput({
    title: "Hi",
    body: "Hi",
    submissionId: SID,
    userId: "someone-else",
    recipients: ["a", "b"],
    recipientUserIds: ["c"],
  });
  assert.equal(parsed.ok, true);
  assert.deepEqual(Object.keys(parsed.ok ? parsed.input : {}).sort(), ["body", "submissionId", "title"]);
});

test("first name is the first word of the name, or null", () => {
  assert.equal(participantFirstName("Alex Synthetic Tester"), "Alex");
  assert.equal(participantFirstName("  Sam  "), "Sam");
  assert.equal(participantFirstName("   "), null);
  assert.equal(participantFirstName(null), null);
  assert.equal(participantFirstName(undefined), null);
});

test("result message names the participant and states what happened to the push", () => {
  const recipient = { name: "Alex Tester", email: "alex@example.test" };
  const created = (push: BroadcastPushSummary) =>
    contactReplyResultMessage({ status: "created", replyId: "r1", recipient, push });

  assert.deepEqual(created({ state: "sent", devices: 2, failed: 0, recipientsWithoutPush: 0 }), {
    tone: "success",
    text: "Reply sent to Alex Tester. Phone push sent to 2 devices.",
  });
  assert.deepEqual(created({ state: "sent", devices: 1, failed: 1, recipientsWithoutPush: 0 }), {
    tone: "warning",
    text: "Reply sent to Alex Tester. Phone push sent to 1 device; 1 device could not be reached.",
  });
  assert.deepEqual(created({ state: "sent", devices: 0, failed: 0, recipientsWithoutPush: 1 }), {
    tone: "success",
    text: "Reply sent to Alex Tester. Alex hasn't turned on phone push, so nothing was pushed. They'll see it under Notifications.",
  });
  assert.deepEqual(created({ state: "sent", devices: 0, failed: 2, recipientsWithoutPush: 0 }), {
    tone: "warning",
    text: "Reply sent to Alex Tester. Phone push could not be sent (2 devices failed).",
  });
  assert.deepEqual(created({ state: "failed" }), {
    tone: "warning",
    text: "Reply sent to Alex Tester. Phone push could not be sent. The reply is in Study Buddy.",
  });
  assert.deepEqual(created({ state: "not-configured" }), {
    tone: "warning",
    text: "Reply sent to Alex Tester. Phone push could not be sent because push isn't set up on this server.",
  });

  assert.deepEqual(
    contactReplyResultMessage({ status: "replayed", recipient: { name: null, email: "anon@example.test" } }),
    { tone: "success", text: "Reply sent to anon@example.test. This reply had already been sent, so nothing was added." }
  );
  assert.equal(
    contactReplyResultMessage({
      status: "created",
      replyId: "r2",
      recipient: { name: null, email: "anon@example.test" },
      push: { state: "sent", devices: 0, failed: 0, recipientsWithoutPush: 1 },
    }).text,
    "Reply sent to anon@example.test. The participant hasn't turned on phone push, so nothing was pushed. They'll see it under Notifications."
  );
});

test("error codes map to 404, 409 or 400", () => {
  assert.equal(contactReplyErrorStatus("not_found"), 404);
  assert.equal(contactReplyErrorStatus("in_progress"), 409);
  assert.equal(contactReplyErrorStatus("deactivated"), 400);
  assert.equal(contactReplyErrorStatus("not_participant"), 400);
  assert.equal(contactReplyErrorStatus("invalid_request"), 400);
});

test("a participant may mark contact replies as read", () => {
  assert.equal(isParticipantReadableNotificationType("contact_reply"), true);
  assert.equal(isParticipantReadableNotificationType("admin_push"), false);
});
