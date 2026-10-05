import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Session } from "next-auth";
import { prisma } from "@/lib/db";
import { assertTestDatabase } from "@/lib/test-support/assert-test-database";
import {
  getParticipantUnreadBroadcastCount,
  listParticipantBroadcasts,
  markNotificationRead,
} from "@/lib/notifications/broadcast-notifications";
import {
  BroadcastInProgressError,
  broadcastToActiveParticipants,
  type BroadcastPushSender,
} from "@/lib/notifications/broadcast-service";
import { sendPushToUsers } from "@/lib/push/send-to-user";
import { WebPushError } from "web-push";

assertTestDatabase();

/**
 * Real Prisma + test.db. Synthetic data only; every row uses this run's unique prefix.
 * The test database may hold other participants, so recipient counts are measured, not assumed.
 */
const PREFIX = `bcast-${process.pid}-${Date.now()}`;

/** Every call below passes a fake sender: these tests must never reach a real push service. */
const noPush: BroadcastPushSender = async () => ({ sent: 0, removed: 0, failed: 0, usersWithSubscription: 0 });
const sid = (name: string) => `${PREFIX}-${name}`.slice(0, 64).replace(/[^A-Za-z0-9-]/g, "-");

let activeA: string;
let activeB: string;
let inactive: string;
let staffUser: string;
let staffAdmin: string;
let session: Session;

async function makeUser(name: string, role: "PARTICIPANT" | "USER" | "ADMIN", isActive = true) {
  return prisma.user.create({
    data: { email: `${PREFIX}-${name}@example.test`, name, role, isActive, passwordHash: "x" },
  });
}

const countForTitle = (userId: string, title: string) =>
  prisma.notification.count({ where: { userId, title, type: "admin_broadcast" } });

const activeParticipantCount = () =>
  prisma.user.count({ where: { role: "PARTICIPANT", isActive: true } });

before(async () => {
  activeA = (await makeUser("active-a", "PARTICIPANT")).id;
  activeB = (await makeUser("active-b", "PARTICIPANT")).id;
  inactive = (await makeUser("inactive", "PARTICIPANT", false)).id;
  staffUser = (await makeUser("staff-user", "USER")).id;
  staffAdmin = (await makeUser("staff-admin", "ADMIN")).id;
  const actor = await prisma.user.create({
    data: { email: `${PREFIX}-super@example.test`, name: "Synthetic super admin", role: "ADMIN", superAdmin: true, passwordHash: "x" },
  });
  session = {
    user: { id: actor.id, name: actor.name, email: actor.email, role: "SUPER_ADMIN", superAdmin: true },
    expires: "",
  } as unknown as Session;
});

after(async () => {
  await prisma.notification.deleteMany({ where: { title: { startsWith: PREFIX } } });
  const events = await prisma.adminAuditEvent.findMany({
    where: { action: "notification.broadcast_sent" },
    select: { id: true, metadata: true },
  });
  const mine = events
    .filter((e) => String((e.metadata as { title?: string } | null)?.title ?? "").startsWith(PREFIX))
    .map((e) => e.id);
  await prisma.adminAuditEvent.deleteMany({ where: { id: { in: mine } } });
  const pushEvents = await prisma.adminAuditEvent.findMany({
    where: { action: "notification.broadcast_push_sent" },
    select: { id: true, metadata: true },
  });
  await prisma.adminAuditEvent.deleteMany({
    where: {
      id: {
        in: pushEvents
          .filter((e) => String((e.metadata as { submissionId?: string } | null)?.submissionId ?? "").startsWith(PREFIX))
          .map((e) => e.id),
      },
    },
  });
  await prisma.pushSubscription.deleteMany({ where: { endpoint: { startsWith: `https://push.example.test/${PREFIX}` } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("broadcastToActiveParticipants (real database)", () => {
  it("creates exactly one notification per active participant and none for inactive users or staff", async () => {
    const title = `${PREFIX} recipients`;
    const expected = await activeParticipantCount();

    const outcome = await broadcastToActiveParticipants(prisma, { sendPush: noPush,
      title,
      body: "Line one\nLine two",
      submissionId: sid("recipients"),
      session,
    });

    assert.equal(outcome.status, "created");
    assert.equal(outcome.status === "created" ? outcome.count : -1, expected);
    assert.equal(await countForTitle(activeA, title), 1);
    assert.equal(await countForTitle(activeB, title), 1);
    assert.equal(await countForTitle(inactive, title), 0, "deactivated participant gets nothing");
    assert.equal(await countForTitle(staffUser, title), 0, "staff get nothing");
    assert.equal(await countForTitle(staffAdmin, title), 0, "staff get nothing");
    assert.equal(await prisma.notification.count({ where: { title } }), expected, "one row per recipient, no more");

    const row = await prisma.notification.findFirstOrThrow({ where: { userId: activeA, title } });
    assert.equal(row.type, "admin_broadcast");
    assert.equal(row.body, "Line one\nLine two");
    assert.equal(row.read, false);
  });

  it("records an audit event whose recipient count matches what was created", async () => {
    const title = `${PREFIX} audit`;
    const outcome = await broadcastToActiveParticipants(prisma, { sendPush: noPush, title, body: null, submissionId: sid("audit"), session });
    assert.equal(outcome.status, "created");
    const created = await prisma.notification.count({ where: { title } });

    const events = await prisma.adminAuditEvent.findMany({ where: { action: "notification.broadcast_sent", actorUserId: session.user.id } });
    const event = events.find((e) => (e.metadata as { title?: string } | null)?.title === title);
    assert.ok(event, "audit event written");
    assert.equal((event.metadata as { recipientCount: number }).recipientCount, created);
    assert.equal((event.metadata as { submissionId: string }).submissionId, sid("audit"));
  });

  it("the same submission id never creates a second set; a new id may repeat the same text", async () => {
    const title = `${PREFIX} repeat`;
    const first = await broadcastToActiveParticipants(prisma, { sendPush: noPush, title, body: null, submissionId: sid("repeat-1"), session });
    assert.equal(first.status, "created");
    const afterFirst = await prisma.notification.count({ where: { title } });

    const again = await broadcastToActiveParticipants(prisma, { sendPush: noPush, title, body: null, submissionId: sid("repeat-1"), session });
    assert.deepEqual(again, { status: "replayed", count: afterFirst });
    assert.equal(await prisma.notification.count({ where: { title } }), afterFirst, "no duplicates");

    const deliberate = await broadcastToActiveParticipants(prisma, { sendPush: noPush, title, body: null, submissionId: sid("repeat-2"), session });
    assert.equal(deliberate.status, "created");
    assert.equal(await prisma.notification.count({ where: { title } }), afterFirst * 2, "an intended re-send is allowed");
  });

  it("two simultaneous submissions with one id: one is created, the other is refused", async () => {
    const title = `${PREFIX} double-click`;
    const input = { title, body: null, submissionId: sid("double"), session };
    const results = await Promise.allSettled([
      broadcastToActiveParticipants(prisma, input),
      broadcastToActiveParticipants(prisma, input),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0]!.reason instanceof BroadcastInProgressError);
    assert.equal(await prisma.notification.count({ where: { title } }), await activeParticipantCount());
  });

  it("if the audit write fails, nothing is kept, and the retry with the same id then succeeds", async () => {
    const title = `${PREFIX} rollback`;
    const input = { title, body: null, submissionId: sid("rollback"), session };

    await assert.rejects(
      () => broadcastToActiveParticipants(prisma, { sendPush: noPush, ...input, writeAudit: async () => { throw new Error("audit store unavailable"); } }),
      /audit store unavailable/
    );
    assert.equal(await prisma.notification.count({ where: { title } }), 0, "no notification without its audit record");

    const retry = await broadcastToActiveParticipants(prisma, input);
    assert.equal(retry.status, "created", "the retry is not mistaken for a replay");
    assert.equal(await prisma.notification.count({ where: { title } }), await activeParticipantCount());
  });

  it("with no active participants it creates nothing and writes no audit event", async () => {
    let created = 0;
    let audited = 0;
    const emptyDb = {
      adminAuditEvent: { findMany: async () => [] },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          user: { findMany: async () => [] },
          notification: { createMany: async () => { created += 1; return { count: 0 }; } },
        }),
    };
    const outcome = await broadcastToActiveParticipants(emptyDb as never, { sendPush: noPush,
      title: "t",
      body: null,
      submissionId: sid("empty"),
      session,
      writeAudit: async () => { audited += 1; },
    });
    assert.deepEqual(outcome, { status: "no-recipients" });
    assert.equal(created, 0);
    assert.equal(audited, 0);
  });
});

describe("participant notifications (real database)", () => {
  async function seed(userId: string, title: string, type: string, createdAt: Date, read = false) {
    return prisma.notification.create({ data: { userId, title: `${PREFIX} ${title}`, type, createdAt, read } });
  }

  it("lists only the user's own broadcasts, newest first, and includes older existing records", async () => {
    const historic = await seed(activeA, "historic", "admin_broadcast", new Date("2026-01-01T00:00:00Z"));
    const newest = await seed(activeA, "newest", "admin_broadcast", new Date("2026-06-01T00:00:00Z"));
    await seed(activeA, "level", "level_1_complete", new Date("2026-07-01T00:00:00Z"));
    await seed(activeA, "single push", "admin_push", new Date("2026-08-01T00:00:00Z"));
    const others = await seed(activeB, "someone else", "admin_broadcast", new Date("2026-09-01T00:00:00Z"));

    const items = (await listParticipantBroadcasts(prisma, activeA, 500)).filter((i) => i.title.startsWith(PREFIX));
    const ids = items.map((i) => i.id);

    assert.ok(ids.includes(historic.id), "a record created before this feature is listed");
    assert.ok(!ids.includes(others.id), "never another user's notification");
    assert.ok(items.every((i) => !/level|single push/.test(i.title)), "other types are not listed");
    assert.ok(ids.indexOf(newest.id) < ids.indexOf(historic.id), "newest first");
  });

  it("counts unread broadcasts, and marking one read lowers the count and is safe to repeat", async () => {
    const n = await seed(activeB, "to read", "admin_broadcast", new Date());
    await seed(activeB, "read already", "admin_broadcast", new Date(), true);
    const before = await getParticipantUnreadBroadcastCount(prisma, activeB);

    assert.equal(await markNotificationRead(prisma, { userId: activeB, notificationId: n.id }), "ok");
    assert.equal(await getParticipantUnreadBroadcastCount(prisma, activeB), before - 1);
    assert.equal(await markNotificationRead(prisma, { userId: activeB, notificationId: n.id }), "ok", "repeat is safe");
    assert.equal(await getParticipantUnreadBroadcastCount(prisma, activeB), before - 1, "and does not change the count again");
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: n.id } })).read, true, "state persists");
  });

  it("a participant cannot read or change another participant's notification", async () => {
    const theirs = await seed(activeA, "private", "admin_broadcast", new Date());
    assert.equal(await markNotificationRead(prisma, { userId: activeB, notificationId: theirs.id }), "not-found");
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: theirs.id } })).read, false, "left untouched");
    assert.equal(await markNotificationRead(prisma, { userId: activeB, notificationId: "no-such-id" }), "not-found");
  });

  it("keeps the original Level completion behaviour and does not open other types", async () => {
    const level = await seed(activeA, "level done", "level_2_complete", new Date());
    const push = await seed(activeA, "single push 2", "admin_push", new Date());
    assert.equal(await markNotificationRead(prisma, { userId: activeA, notificationId: level.id }), "ok");
    assert.equal(await markNotificationRead(prisma, { userId: activeA, notificationId: push.id }), "not-found");
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: push.id } })).read, false);
  });
});

describe("phone push for a broadcast (real database, fake push service)", () => {
  const endpoint = (name: string) => `https://push.example.test/${PREFIX}/${name}`;
  const addSubscription = (userId: string, name: string) =>
    prisma.pushSubscription.create({ data: { endpoint: endpoint(name), p256dh: "k", auth: "a", userId } });

  it("sendPushToUsers reaches only the listed users' devices and drops subscriptions the push service has retired", async () => {
    await addSubscription(activeA, "a1");
    await addSubscription(activeA, "a2");
    await addSubscription(activeB, "b-gone");
    await addSubscription(staffUser, "staff-device");
    const reached: string[] = [];

    const result = await sendPushToUsers(
      [activeA, activeB],
      { title: " ", body: "t", url: "/x" },
      {
        deliver: async (sub) => {
          reached.push(sub.endpoint);
          if (sub.endpoint === endpoint("b-gone")) throw new WebPushError("Gone", 410, {}, "", sub.endpoint);
        },
      }
    );

    assert.deepEqual(reached.sort(), [endpoint("a1"), endpoint("a2"), endpoint("b-gone")].sort(), "never the staff device");
    assert.equal(result.sent, 2);
    assert.equal(result.removed, 1);
    assert.equal(result.failed, 0);
    assert.equal(result.usersWithSubscription, 2);
    assert.equal(await prisma.pushSubscription.count({ where: { endpoint: endpoint("b-gone") } }), 0, "retired subscription removed");
    assert.equal(await prisma.pushSubscription.count({ where: { endpoint: endpoint("staff-device") } }), 1, "untouched");
  });

  it("a transient failure is counted but the subscription is kept; sending stays within the concurrency limit", async () => {
    await addSubscription(activeA, "c1");
    await addSubscription(activeA, "c2");
    await addSubscription(activeB, "c3");
    let running = 0;
    let peak = 0;

    const result = await sendPushToUsers(
      [activeA, activeB],
      { title: " ", body: "t", url: "/x" },
      {
        concurrency: 2,
        deliver: async (sub) => {
          running += 1;
          peak = Math.max(peak, running);
          await new Promise((r) => setTimeout(r, 15));
          running -= 1;
          if (sub.endpoint === endpoint("c2")) throw new WebPushError("Server error", 500, {}, "", sub.endpoint);
        },
      }
    );

    assert.ok(result.failed >= 1);
    assert.ok(peak <= 2, `peak concurrency ${peak}`);
    assert.equal(await prisma.pushSubscription.count({ where: { endpoint: endpoint("c2") } }), 1, "kept after a 500");
  });

  it("with nobody to push to it does not touch the database or the network", async () => {
    assert.deepEqual(await sendPushToUsers([], { title: " ", body: "t", url: "/x" }), {
      sent: 0, removed: 0, failed: 0, usersWithSubscription: 0,
    });
  });

  it("a broadcast pushes after the notifications are stored, to the recipients only, with the title only", async () => {
    const title = `${PREFIX} push title`;
    let calls = 0;
    let storedWhenPushed = -1;
    let pushedTo: readonly string[] = [];
    let payload: unknown = null;
    const sendPush: BroadcastPushSender = async (ids, p) => {
      calls += 1;
      pushedTo = ids;
      payload = p;
      storedWhenPushed = await prisma.notification.count({ where: { title } });
      return { sent: 3, removed: 0, failed: 1, usersWithSubscription: 2 };
    };

    const outcome = await broadcastToActiveParticipants(prisma, {
      title,
      body: "SECRET-BODY-TEXT",
      submissionId: sid("push-1"),
      session,
      sendPush,
    });

    const expected = await activeParticipantCount();
    assert.equal(outcome.status, "created");
    assert.equal(calls, 1);
    assert.equal(storedWhenPushed, expected, "in-app notifications already existed when the push started");
    assert.equal(pushedTo.length, expected);
    assert.ok(pushedTo.includes(activeA) && pushedTo.includes(activeB));
    assert.ok(!pushedTo.includes(inactive) && !pushedTo.includes(staffUser) && !pushedTo.includes(staffAdmin));
    assert.deepEqual(payload, { title: " ", body: title, url: "/dashboard/notifications" });
    assert.ok(!JSON.stringify(payload).includes("SECRET-BODY-TEXT"), "the message text never goes out in the push");
    assert.deepEqual(outcome.status === "created" ? outcome.push : null, {
      state: "sent", devices: 3, failed: 1, recipientsWithoutPush: expected - 2,
    });

    const events = await prisma.adminAuditEvent.findMany({ where: { action: "notification.broadcast_push_sent" } });
    const event = events.find((e) => (e.metadata as { submissionId?: string } | null)?.submissionId === sid("push-1"));
    assert.ok(event, "push result recorded");
    assert.deepEqual(event.metadata, { submissionId: sid("push-1"), state: "sent", devices: 3, failed: 1, recipientsWithoutPush: expected - 2 });
  });

  it("a repeated submission never pushes again", async () => {
    const title = `${PREFIX} push once`;
    let calls = 0;
    const sendPush: BroadcastPushSender = async () => { calls += 1; return { sent: 1, removed: 0, failed: 0, usersWithSubscription: 1 }; };
    const input = { title, body: null, submissionId: sid("push-2"), session, sendPush };

    await broadcastToActiveParticipants(prisma, input);
    const again = await broadcastToActiveParticipants(prisma, input);

    assert.equal(again.status, "replayed");
    assert.equal(calls, 1);
  });

  it("if the push fails the in-app notifications stay and the admin is told the push failed", async () => {
    const title = `${PREFIX} push fails`;
    const outcome = await broadcastToActiveParticipants(prisma, {
      title, body: null, submissionId: sid("push-3"), session,
      sendPush: async () => { throw new Error("push service down"); },
    });
    assert.deepEqual(outcome, { status: "created", count: await activeParticipantCount(), push: { state: "failed" } });
    assert.equal(await prisma.notification.count({ where: { title } }), await activeParticipantCount());

    const notConfigured = await broadcastToActiveParticipants(prisma, {
      title: `${PREFIX} push unconfigured`, body: null, submissionId: sid("push-4"), session,
      sendPush: async () => { throw new Error("Push is not configured (VAPID keys or VAPID_MAILTO missing)"); },
    });
    assert.equal(notConfigured.status === "created" ? notConfigured.push?.state : null, "not-configured");
  });

  it("nothing is pushed when nothing was stored (audit failure, or no recipients)", async () => {
    let calls = 0;
    const sendPush: BroadcastPushSender = async () => { calls += 1; return { sent: 0, removed: 0, failed: 0, usersWithSubscription: 0 }; };

    await assert.rejects(() =>
      broadcastToActiveParticipants(prisma, {
        title: `${PREFIX} no push on rollback`, body: null, submissionId: sid("push-5"), session, sendPush,
        writeAudit: async () => { throw new Error("audit store unavailable"); },
      })
    );
    assert.equal(calls, 0);
  });
});
