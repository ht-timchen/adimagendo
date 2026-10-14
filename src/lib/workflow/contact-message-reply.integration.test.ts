import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Session } from "next-auth";
import { prisma } from "@/lib/db";
import { assertTestDatabase } from "@/lib/test-support/assert-test-database";
import {
  ContactReplyError,
  replyToContactMessage,
  validateContactReplyInput,
  type ContactReplyPushSender,
} from "@/lib/admin/contact-message-reply";
import {
  getParticipantUnreadBroadcastCount,
  listParticipantBroadcasts,
  markNotificationRead,
} from "@/lib/notifications/broadcast-notifications";

assertTestDatabase();

/** Real Prisma + test.db. Synthetic data only; every row uses this run's unique prefix. */
const PREFIX = `creply-${process.pid}-${Date.now()}`;

/** Every call below passes a fake sender: these tests must never reach a real push service. */
const noPush: ContactReplyPushSender = async () => ({ sent: 0, removed: 0, failed: 0, usersWithSubscription: 0 });
const sid = (name: string) => `${PREFIX}-${name}`.slice(0, 64).replace(/[^A-Za-z0-9-]/g, "-");

let author: string;
let otherParticipant: string;
let deactivated: string;
let session: Session;

async function makeUser(name: string, isActive = true) {
  return prisma.user.create({
    data: { email: `${PREFIX}-${name}@example.test`, name, role: "PARTICIPANT", isActive, passwordHash: "x" },
  });
}

async function makeMessage(userId: string, subject: string) {
  return prisma.contactMessage.create({
    data: { userId, subject: `${PREFIX} ${subject}`, message: "Synthetic question" },
  });
}

const repliesFor = (contactMessageId: string) =>
  prisma.contactMessageReply.findMany({ where: { contactMessageId }, include: { notification: true } });

const auditEventsFor = (contactMessageId: string) =>
  prisma.adminAuditEvent.findMany({ where: { action: "contact_message.replied", targetId: contactMessageId } });

before(async () => {
  author = (await makeUser("Alex Author")).id;
  otherParticipant = (await makeUser("Olive Other")).id;
  deactivated = (await makeUser("Dee Deactivated", false)).id;
  const actor = await prisma.user.create({
    data: { email: `${PREFIX}-admin@example.test`, name: "Synthetic admin", role: "ADMIN", passwordHash: "x" },
  });
  session = {
    user: { id: actor.id, name: actor.name, email: actor.email, role: "ADMIN", superAdmin: false },
    expires: "",
  } as unknown as Session;
});

after(async () => {
  const messages = await prisma.contactMessage.findMany({
    where: { subject: { startsWith: PREFIX } },
    select: { id: true },
  });
  await prisma.adminAuditEvent.deleteMany({
    where: { action: "contact_message.replied", targetId: { in: messages.map((m) => m.id) } },
  });
  // Deleting the users removes their messages, notifications and replies (cascade).
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("replyToContactMessage (real database)", () => {
  it("always delivers to the message author, even if the request names another user", async () => {
    const message = await makeMessage(author, "recipient");
    const parsed = validateContactReplyInput({
      title: "Reply from the AD-IMAGENDO team",
      body: "Line one\nLine two",
      submissionId: sid("recipient"),
      userId: otherParticipant,
    });
    assert.ok(parsed.ok);

    const outcome = await replyToContactMessage(prisma, {
      ...parsed.input,
      session,
      contactMessageId: message.id,
      sendPush: noPush,
    });

    assert.equal(outcome.status, "created");
    const replies = await repliesFor(message.id);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].notification.userId, author);
    assert.equal(replies[0].notification.type, "contact_reply");
    assert.equal(replies[0].notification.body, "Line one\nLine two");
    assert.equal(replies[0].adminUserId, session.user.id);
    assert.equal(replies[0].adminName, "Synthetic admin");
    assert.equal(
      await prisma.notification.count({ where: { userId: otherParticipant, type: "contact_reply" } }),
      0,
      "the other participant gets nothing"
    );
  });

  it("writes one audit event with only the message and notification ids", async () => {
    const message = await makeMessage(author, "audit");
    await replyToContactMessage(prisma, {
      title: "Audit check",
      body: "Synthetic body text",
      submissionId: sid("audit"),
      session,
      contactMessageId: message.id,
      sendPush: noPush,
    });

    const [reply] = await repliesFor(message.id);
    const events = await auditEventsFor(message.id);
    assert.equal(events.length, 1);
    assert.equal(events[0].targetType, "contact_message");
    assert.deepEqual(events[0].metadata, { contactMessageId: message.id, notificationId: reply.notificationId });
  });

  it("refuses a deactivated participant and stores nothing", async () => {
    const message = await makeMessage(deactivated, "deactivated");
    await assert.rejects(
      replyToContactMessage(prisma, {
        title: "Hello",
        body: "Hello",
        submissionId: sid("deactivated"),
        session,
        contactMessageId: message.id,
        sendPush: noPush,
      }),
      (e: unknown) =>
        e instanceof ContactReplyError &&
        e.code === "deactivated" &&
        e.message === "This participant's account is deactivated"
    );
    assert.equal((await repliesFor(message.id)).length, 0);
    assert.equal(await prisma.notification.count({ where: { userId: deactivated } }), 0);
    assert.equal((await auditEventsFor(message.id)).length, 0);
  });

  it("answers not_found for an unknown message", async () => {
    await assert.rejects(
      replyToContactMessage(prisma, {
        title: "Hello",
        body: "Hello",
        submissionId: sid("missing"),
        session,
        contactMessageId: `${PREFIX}-missing`,
        sendPush: noPush,
      }),
      (e: unknown) => e instanceof ContactReplyError && e.code === "not_found"
    );
  });

  it("the same submission id sends once, one after the other or at the same time", async () => {
    const message = await makeMessage(author, "double");
    let pushes = 0;
    const countingPush: ContactReplyPushSender = async (ids, payload) => {
      pushes += 1;
      return noPush(ids, payload);
    };
    const send = (submissionId: string) =>
      replyToContactMessage(prisma, {
        title: "Double click",
        body: "Once only",
        submissionId,
        session,
        contactMessageId: message.id,
        sendPush: countingPush,
      });

    const first = await send(sid("double-seq"));
    const again = await send(sid("double-seq"));
    assert.equal(first.status, "created");
    assert.equal(again.status, "replayed");

    const results = await Promise.allSettled([send(sid("double-par")), send(sid("double-par"))]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    const reason = (rejected[0] as PromiseRejectedResult).reason;
    assert.ok(reason instanceof ContactReplyError && reason.code === "in_progress");

    assert.equal((await repliesFor(message.id)).length, 2, "one reply per submission id");
    assert.equal((await auditEventsFor(message.id)).length, 2);
    assert.equal(pushes, 2, "a replay never pushes again");
  });

  it("a push failure keeps the reply", async () => {
    const message = await makeMessage(author, "push-fail");
    const failing: ContactReplyPushSender = async () => {
      throw new Error("push service down");
    };
    const outcome = await replyToContactMessage(prisma, {
      title: "Push fails",
      body: "Still stored",
      submissionId: sid("push-fail"),
      session,
      contactMessageId: message.id,
      sendPush: failing,
    });
    assert.equal(outcome.status, "created");
    assert.deepEqual(outcome.status === "created" ? outcome.push : null, { state: "failed" });
    assert.equal((await repliesFor(message.id)).length, 1);

    const notConfigured: ContactReplyPushSender = async () => {
      throw new Error("Push is not configured: VAPID keys missing");
    };
    const second = await replyToContactMessage(prisma, {
      title: "Push not set up",
      body: "Still stored",
      submissionId: sid("push-unset"),
      session,
      contactMessageId: message.id,
      sendPush: notConfigured,
    });
    assert.deepEqual(second.status === "created" ? second.push : null, { state: "not-configured" });
    assert.equal((await repliesFor(message.id)).length, 2);
  });

  it("pushes a fixed text to the author only, never the admin's title or body", async () => {
    const message = await makeMessage(author, "push-payload");
    const calls: { ids: readonly string[]; payload: unknown }[] = [];
    await replyToContactMessage(prisma, {
      title: "Admin title stays in the app",
      body: "Body stays in the app",
      submissionId: sid("push-payload"),
      session,
      contactMessageId: message.id,
      sendPush: async (ids, payload) => {
        calls.push({ ids, payload });
        return { sent: 1, removed: 0, failed: 0, usersWithSubscription: 1 };
      },
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].ids, [author]);
    assert.deepEqual(calls[0].payload, {
      title: " ",
      body: "You have a new message from the study team.",
      url: "/dashboard/notifications",
    });

    const [reply] = await repliesFor(message.id);
    assert.equal(reply.notification.title, "Admin title stays in the app", "the in-app notification keeps the admin's title");
    assert.equal(reply.notification.body, "Body stays in the app");
  });
});

describe("contact replies in the participant's notifications (real database)", () => {
  it("are listed with the original subject, counted as unread, and can be marked read", async () => {
    const message = await makeMessage(otherParticipant, "inbox");
    const before = await getParticipantUnreadBroadcastCount(prisma, otherParticipant);

    await replyToContactMessage(prisma, {
      title: "Inbox reply",
      body: "Synthetic reply",
      submissionId: sid("inbox"),
      session,
      contactMessageId: message.id,
      sendPush: noPush,
    });
    const [reply] = await repliesFor(message.id);

    const items = await listParticipantBroadcasts(prisma, otherParticipant, 500);
    const item = items.find((i) => i.id === reply.notificationId);
    assert.ok(item, "listed");
    assert.equal(item.title, "Inbox reply");
    assert.equal(item.replyToSubject, `${PREFIX} inbox`);
    assert.equal(item.read, false);
    assert.equal(await getParticipantUnreadBroadcastCount(prisma, otherParticipant), before + 1);

    assert.equal(
      await markNotificationRead(prisma, { userId: author, notificationId: reply.notificationId }),
      "not-found",
      "someone else cannot mark it"
    );
    assert.equal(
      await markNotificationRead(prisma, { userId: otherParticipant, notificationId: reply.notificationId }),
      "ok"
    );
    assert.equal(await getParticipantUnreadBroadcastCount(prisma, otherParticipant), before);
  });
});
