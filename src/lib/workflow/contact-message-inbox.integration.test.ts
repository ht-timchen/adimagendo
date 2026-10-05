import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { assertTestDatabase } from "@/lib/test-support/assert-test-database";
import {
  getContactMessageDetail,
  listContactMessages,
  OTHER_MESSAGES_LIMIT,
  previewMessage,
} from "@/lib/admin/contact-message-inbox";

assertTestDatabase();

/**
 * Real Prisma + test.db. Synthetic data only; every row uses this run's unique prefix.
 * The test database may hold other messages, so list checks look at this run's rows only.
 */
const PREFIX = `inbox-${process.pid}-${Date.now()}`;
const MINUTE = 60_000;
const BASE = Date.UTC(2026, 9, 1, 0, 0, 0);

let alice: { id: string; email: string };
let ben: { id: string; email: string };
let noProfile: { id: string };
let longMessageId: string;
let currentId: string;
const aliceMessageIds: string[] = [];

const LONG_BODY = [
  "First paragraph of a long message. ".repeat(20).trim(),
  "",
  "Second paragraph after a blank line, with <b>tags</b> & <script>alert('x')</script> kept as text.",
  "A third line.\nA fourth line.",
  "x".repeat(300),
].join("\n");

async function addUser(name: string, studyRecordId: string | null) {
  const user = await prisma.user.create({
    data: { email: `${PREFIX}-${name}@example.test`, name: `Synthetic ${name}`, role: "PARTICIPANT", passwordHash: "x" },
  });
  if (studyRecordId) {
    await prisma.participantProfile.create({
      data: { userId: user.id, studyRecordId, enrollmentDate: new Date(), dataSource: "REDCAP", dataKind: "TEST" },
    });
  }
  return user;
}

const addMessage = (userId: string, subject: string, message: string, minutes: number, category: string | null = null) =>
  prisma.contactMessage.create({
    data: { userId, subject, message, category, createdAt: new Date(BASE + minutes * MINUTE) },
  });

before(async () => {
  alice = await addUser("alice", `${PREFIX}-REC-A`);
  ben = await addUser("ben", `${PREFIX}-REC-B`);
  noProfile = await addUser("noprofile", null);

  // alice: 24 messages, minute 0..23. The long one is minute 10 and is the one we open.
  for (let i = 0; i < 24; i += 1) {
    const created =
      i === 10
        ? await addMessage(alice.id, `${PREFIX} long message`, LONG_BODY, i, "General")
        : await addMessage(alice.id, `${PREFIX} alice ${i}`, `short ${i}`, i);
    aliceMessageIds.push(created.id);
    if (i === 10) longMessageId = created.id;
  }
  currentId = longMessageId;

  await addMessage(ben.id, `${PREFIX} ben 1`, "ben says hello", 5);
  await addMessage(ben.id, `${PREFIX} ben 2`, "ben says more", 30);
  await addMessage(noProfile.id, `${PREFIX} solo`, "only message", 40);
});

after(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("getContactMessageDetail (real database)", () => {
  it("returns the full text exactly as written, with the participant details", async () => {
    const detail = await getContactMessageDetail(currentId);
    assert.ok(detail);
    assert.equal(detail.message.body, LONG_BODY, "no truncation, line breaks kept, tags not altered");
    assert.ok(detail.message.body.length > 1000);
    assert.equal(detail.message.subject, `${PREFIX} long message`);
    assert.equal(detail.message.category, "General");
    assert.equal(detail.message.createdAt.toISOString(), new Date(BASE + 10 * MINUTE).toISOString());
    assert.deepEqual(detail.message.participant, {
      id: alice.id,
      name: "Synthetic alice",
      email: alice.email,
      studyRecordId: `${PREFIX}-REC-A`,
    });
  });

  it("other messages: only this participant's, never the current one, newest first, at most 20", async () => {
    const detail = await getContactMessageDetail(currentId);
    assert.ok(detail);
    const others = detail.otherMessages;

    assert.equal(others.length, OTHER_MESSAGES_LIMIT);
    assert.ok(others.every((m) => aliceMessageIds.includes(m.id)), "all from the same participant");
    assert.ok(!others.some((m) => m.id === currentId), "the open message is not repeated");
    assert.ok(others.every((m) => !m.subject.includes("ben") && !m.subject.includes("solo")), "no other participant's message");

    const times = others.map((m) => m.createdAt.getTime());
    assert.deepEqual(times, [...times].sort((a, b) => b - a), "newest first");
    assert.equal(others[0]!.createdAt.toISOString(), new Date(BASE + 23 * MINUTE).toISOString());
    assert.equal(others[0]!.preview, "short 23");
  });

  it("a participant with fewer than 20 other messages gets exactly those", async () => {
    const benFirst = (await listContactMessages({ participantUserId: ben.id })).messages.at(-1)!;
    const detail = await getContactMessageDetail(benFirst.id);
    assert.ok(detail);
    assert.deepEqual(detail.otherMessages.map((m) => m.subject), [`${PREFIX} ben 2`]);
  });

  it("a participant with no other messages gets an empty list, and no profile means no record id", async () => {
    const solo = (await listContactMessages({ participantUserId: noProfile.id })).messages[0]!;
    const detail = await getContactMessageDetail(solo.id);
    assert.ok(detail);
    assert.deepEqual(detail.otherMessages, []);
    assert.equal(detail.message.participant.studyRecordId, null);
  });

  it("returns null when the message does not exist", async () => {
    assert.equal(await getContactMessageDetail("no-such-message"), null);
    assert.equal(await getContactMessageDetail(""), null);
  });
});

describe("listContactMessages (real database)", () => {
  const mine = <T extends { subject: string }>(rows: T[]) => rows.filter((r) => r.subject.startsWith(PREFIX));

  it("without a filter it lists everyone's messages, newest first, with one-line previews", async () => {
    const { messages, participant } = await listContactMessages();
    assert.equal(participant, null);
    const rows = mine(messages);
    assert.equal(rows.length, 24 + 2 + 1);
    const times = rows.map((r) => r.createdAt.getTime());
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
    const long = rows.find((r) => r.id === longMessageId)!;
    assert.ok(long.preview.length <= 121 && long.preview.endsWith("…"), "long text is cut for the list only");
    assert.ok(!long.preview.includes("\n"));
  });

  it("filtering by participant returns only that participant's messages", async () => {
    const result = await listContactMessages({ participantUserId: ben.id });
    assert.equal(result.participant?.id, ben.id);
    assert.equal(result.participant?.email, ben.email);
    assert.deepEqual(result.messages.map((m) => m.subject), [`${PREFIX} ben 2`, `${PREFIX} ben 1`]);
    assert.ok(result.messages.every((m) => m.participant.id === ben.id));
  });

  it("an unknown or malformed participant id is ignored instead of failing", async () => {
    for (const bad of ["no-such-user", "", "   ", "x".repeat(200), "' OR 1=1 --"]) {
      const result = await listContactMessages({ participantUserId: bad });
      assert.equal(result.participant, null, JSON.stringify(bad));
      assert.equal(mine(result.messages).length, 27, "the whole inbox comes back");
    }
  });

  it("a real participant with no messages gives an empty list, not the whole inbox", async () => {
    const quiet = await addUser("quiet", null);
    const result = await listContactMessages({ participantUserId: quiet.id });
    assert.equal(result.participant?.id, quiet.id);
    assert.deepEqual(result.messages, []);
  });
});

describe("previewMessage", () => {
  it("collapses whitespace and cuts at 120 characters", () => {
    assert.equal(previewMessage("a\n\n  b\tc"), "a b c");
    assert.equal(previewMessage("x".repeat(120)), "x".repeat(120));
    assert.equal(previewMessage("x".repeat(121)), `${"x".repeat(120)}…`);
  });
});

describe("message text is only ever rendered as plain text", () => {
  it("the detail page never injects HTML or renders markdown", async () => {
    const source = await readFile(new URL("../../app/(dashboard)/dashboard/admin/messages/[id]/page.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
    assert.doesNotMatch(source, /react-markdown|marked|markdown-it|remark|innerHTML/i);
    assert.match(source, /whitespace-pre-wrap/);
    assert.match(source, /break-words/);
  });

  it("the detail page checks the contact_message:read permission itself", async () => {
    const source = await readFile(new URL("../../app/(dashboard)/dashboard/admin/messages/[id]/page.tsx", import.meta.url), "utf8");
    assert.match(source, /requirePermissionOrRedirect\("contact_message:read"\)/);
    assert.match(source, /notFound\(\)/);
  });

  it("only the inbox list marks messages as seen, not the detail page", async () => {
    const list = await readFile(new URL("../../app/(dashboard)/dashboard/admin/messages/page.tsx", import.meta.url), "utf8");
    const detail = await readFile(new URL("../../app/(dashboard)/dashboard/admin/messages/[id]/page.tsx", import.meta.url), "utf8");
    assert.match(list, /<MarkContactMessagesSeen \/>/);
    assert.doesNotMatch(detail, /MarkContactMessagesSeen/);
  });
});
