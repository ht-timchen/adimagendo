import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { assertTestDatabase } from "@/lib/test-support/assert-test-database";
import { createClassificationFixtures } from "@/lib/test-support/classification-fixtures";
import { ADMIN_AUDIT_ACTIONS } from "@/lib/admin-audit";
import { resolveEnrollmentDateForTiming } from "@/lib/checklist/enrollment-date-for-timing";
import { adelaideCivilDate } from "@/lib/dates/adelaide-calendar";
import {
  MARK_TEST_NOT_ELIGIBLE_MESSAGE,
  MARK_TEST_PILOT_MESSAGE,
  markParticipantAsTest,
  UNMARK_TEST_DUMMY_RECORD_MESSAGE,
  UNMARK_TEST_NOT_ELIGIBLE_MESSAGE,
  unmarkTestParticipant,
} from "./mark-test-participant";
import { getParticipantClassificationHistory } from "./classification-history";

assertTestDatabase();

const fx = createClassificationFixtures("mark-test");

after(async () => {
  await fx.cleanup();
});

const PROFILE_DATE = new Date("2026-03-01T01:30:00.000Z");
const CONSENT_DATE = new Date("2026-01-15T04:12:00.000Z");
const RECORD_IS_TEST = { reasonCode: "RECORD_IS_TEST" };
const MISTAKE = { reasonCode: "MARKED_TEST_BY_MISTAKE" };

async function superAdmin() {
  return fx.createStaff({ superAdmin: true });
}

async function redcapParticipant(
  dataKind: "UNKNOWN" | "TEST" | "REAL",
  options: { consentDate?: Date | null; studyRecordId?: string } = {}
) {
  const studyRecordId = options.studyRecordId ?? fx.uniqueRecordId();
  const participant = await fx.createParticipant({
    dataSource: "REDCAP",
    dataKind,
    enrollmentDate: PROFILE_DATE,
    studyRecordId,
  });
  if (options.consentDate !== undefined) {
    await fx.createSyncRow(studyRecordId, options.consentDate);
  }
  return participant;
}

describe("markParticipantAsTest: server-side permission", () => {
  it("rejects an ADMIN session", async () => {
    const admin = await fx.createStaff({ superAdmin: false });
    const p = await redcapParticipant("UNKNOWN");
    const result = await markParticipantAsTest({
      userId: p.userId,
      session: admin,
      reason: RECORD_IS_TEST,
    });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error, "forbidden");
    assert.equal((await fx.getProfile(p.userId)).dataKind, "UNKNOWN");
    assert.equal((await fx.getAuditEvents(p.userId)).length, 0);
  });

  it("rejects a USER session", async () => {
    const user = await fx.createStaff({ role: "USER", superAdmin: false });
    const p = await redcapParticipant("UNKNOWN");
    const result = await markParticipantAsTest({
      userId: p.userId,
      session: user,
      reason: RECORD_IS_TEST,
    });
    assert.equal(!result.ok && result.error, "forbidden");
  });

  it("rejects a session claiming SUPER_ADMIN when the database says otherwise", async () => {
    const admin = await fx.createStaff({ superAdmin: false });
    const p = await redcapParticipant("UNKNOWN");
    const result = await markParticipantAsTest({
      userId: p.userId,
      session: fx.staleSuperAdminSession(admin),
      reason: RECORD_IS_TEST,
    });
    assert.equal(!result.ok && result.error, "forbidden");
    assert.equal((await fx.getProfile(p.userId)).dataKind, "UNKNOWN");
  });

  it("rejects a deactivated super admin", async () => {
    const inactive = await fx.createStaff({ superAdmin: true, isActive: false });
    const p = await redcapParticipant("UNKNOWN");
    const result = await markParticipantAsTest({
      userId: p.userId,
      session: inactive,
      reason: RECORD_IS_TEST,
    });
    assert.equal(!result.ok && result.error, "forbidden");
  });
});

describe("markParticipantAsTest: eligibility", () => {
  it("marks REDCAP + UNKNOWN as TEST and copies the synced consent date", async () => {
    const session = await superAdmin();
    const p = await redcapParticipant("UNKNOWN", { consentDate: CONSENT_DATE });
    const before = await resolveEnrollmentDateForTiming({
      ...(await fx.getProfile(p.userId)),
      studyRecordId: p.studyRecordId,
    });

    const result = await markParticipantAsTest({
      userId: p.userId,
      session,
      reason: RECORD_IS_TEST,
    });
    assert.equal(result.ok, true);

    const profile = await fx.getProfile(p.userId);
    assert.equal(profile.dataSource, "REDCAP");
    assert.equal(profile.dataKind, "TEST");
    assert.equal(profile.enrollmentDate.toISOString(), CONSENT_DATE.toISOString());

    const after = await resolveEnrollmentDateForTiming({
      ...profile,
      studyRecordId: p.studyRecordId,
    });
    assert.deepEqual(
      adelaideCivilDate(after.enrollmentDate!),
      adelaideCivilDate(before.enrollmentDate!),
      "Day 0 must not move when marking as test"
    );

    const sync = await prisma.redcapParticipantSync.findUniqueOrThrow({
      where: { studyRecordId: p.studyRecordId! },
      select: { enrollmentDate: true, dataKind: true },
    });
    assert.equal(sync.enrollmentDate?.toISOString(), CONSENT_DATE.toISOString());
    assert.equal(sync.dataKind, "UNKNOWN");
  });

  it("keeps the profile date when there is no synced consent date", async () => {
    const session = await superAdmin();
    const p = await redcapParticipant("UNKNOWN");
    const result = await markParticipantAsTest({
      userId: p.userId,
      session,
      reason: RECORD_IS_TEST,
    });
    assert.equal(result.ok, true);
    const profile = await fx.getProfile(p.userId);
    assert.equal(profile.dataKind, "TEST");
    assert.equal(profile.enrollmentDate.toISOString(), PROFILE_DATE.toISOString());
  });

  it("rejects a REAL pilot participant", async () => {
    const session = await superAdmin();
    const p = await redcapParticipant("REAL");
    const result = await markParticipantAsTest({
      userId: p.userId,
      session,
      reason: RECORD_IS_TEST,
    });
    assert.equal(!result.ok && result.message, MARK_TEST_PILOT_MESSAGE);
    assert.equal((await fx.getProfile(p.userId)).dataKind, "REAL");
    assert.equal((await fx.getAuditEvents(p.userId)).length, 0);
  });

  it("rejects a LOCAL account", async () => {
    const session = await superAdmin();
    const p = await fx.createParticipant({
      dataSource: "LOCAL",
      dataKind: "TEST",
      enrollmentDate: PROFILE_DATE,
      studyRecordId: null,
    });
    const result = await markParticipantAsTest({
      userId: p.userId,
      session,
      reason: RECORD_IS_TEST,
    });
    assert.equal(!result.ok && result.message, MARK_TEST_NOT_ELIGIBLE_MESSAGE);
    assert.equal((await fx.getAuditEvents(p.userId)).length, 0);
  });

  it("rejects an account that is already TEST", async () => {
    const session = await superAdmin();
    const p = await redcapParticipant("TEST");
    const result = await markParticipantAsTest({
      userId: p.userId,
      session,
      reason: RECORD_IS_TEST,
    });
    assert.equal(!result.ok && result.error, "unchanged");
  });
});

describe("markParticipantAsTest: reason", () => {
  it("requires a reason", async () => {
    const session = await superAdmin();
    const p = await redcapParticipant("UNKNOWN");
    const result = await markParticipantAsTest({ userId: p.userId, session, reason: {} });
    assert.equal(!result.ok && result.error, "invalid_reason");
    assert.equal((await fx.getProfile(p.userId)).dataKind, "UNKNOWN");
    assert.equal((await fx.getAuditEvents(p.userId)).length, 0);
  });

  it("requires free text for Other", async () => {
    const session = await superAdmin();
    const p = await redcapParticipant("UNKNOWN");
    const result = await markParticipantAsTest({
      userId: p.userId,
      session,
      reason: { reasonCode: "OTHER", reasonText: "  " },
    });
    assert.equal(!result.ok && result.error, "invalid_reason");
    assert.equal((await fx.getProfile(p.userId)).dataKind, "UNKNOWN");
  });
});

describe("markParticipantAsTest: audit", () => {
  it("writes exactly one audit event with old value, new value and reason", async () => {
    const session = await superAdmin();
    const p = await redcapParticipant("UNKNOWN", { consentDate: CONSENT_DATE });
    const result = await markParticipantAsTest({
      userId: p.userId,
      session,
      reason: { reasonCode: "OTHER", reasonText: "Numeric REDCap test record" },
    });
    assert.equal(result.ok, true);

    const events = await fx.getAuditEvents(p.userId);
    assert.equal(events.length, 1);
    const event = events[0]!;
    assert.equal(event.action, ADMIN_AUDIT_ACTIONS.PARTICIPANT_MARKED_TEST);
    assert.equal(event.actorUserId, session.user.id);
    assert.equal(event.actorRole, "SUPER_ADMIN");
    const metadata = event.metadata as Record<string, unknown>;
    assert.equal(metadata.studyRecordId, p.studyRecordId);
    assert.equal(metadata.field, "dataKind");
    assert.equal(metadata.from, "UNKNOWN");
    assert.equal(metadata.to, "TEST");
    assert.equal(metadata.reasonCode, "OTHER");
    assert.equal(metadata.reasonText, "Numeric REDCap test record");
    assert.deepEqual(metadata.enrollmentDate, {
      from: { date: "2026-03-01", at: PROFILE_DATE.toISOString() },
      to: { date: "2026-01-15", at: CONSENT_DATE.toISOString() },
      changed: true,
    });
  });

  it("rolls back the change when the audit write fails", async () => {
    const session = await superAdmin();
    const p = await redcapParticipant("UNKNOWN");
    type InteractiveTransaction = (
      fn: (tx: object) => Promise<unknown>
    ) => Promise<unknown>;
    const originalTransaction = prisma.$transaction;
    const runTransaction = originalTransaction as unknown as InteractiveTransaction;
    prisma.$transaction = ((fn: (tx: object) => Promise<unknown>) =>
      runTransaction.call(prisma, async (tx) =>
        fn(
          new Proxy(tx, {
            get(target, prop, receiver) {
              if (prop === "adminAuditEvent") {
                return {
                  create: async () => {
                    throw new Error("simulated audit failure");
                  },
                };
              }
              return Reflect.get(target, prop, receiver);
            },
          })
        )
      )) as unknown as typeof prisma.$transaction;

    try {
      await assert.rejects(
        markParticipantAsTest({ userId: p.userId, session, reason: RECORD_IS_TEST }),
        /simulated audit failure/
      );
    } finally {
      prisma.$transaction = originalTransaction;
    }
    assert.equal((await fx.getProfile(p.userId)).dataKind, "UNKNOWN");
    assert.equal((await fx.getAuditEvents(p.userId)).length, 0);
  });
});

describe("unmarkTestParticipant", () => {
  it("changes REDCAP + TEST back to UNKNOWN and restores the synced consent date", async () => {
    const session = await superAdmin();
    const p = await redcapParticipant("TEST", { consentDate: CONSENT_DATE });
    const result = await unmarkTestParticipant({ userId: p.userId, session, reason: MISTAKE });
    assert.equal(result.ok, true);
    const profile = await fx.getProfile(p.userId);
    assert.equal(profile.dataKind, "UNKNOWN");
    assert.equal(profile.enrollmentDate.toISOString(), CONSENT_DATE.toISOString());

    const events = await fx.getAuditEvents(p.userId);
    assert.equal(events.length, 1);
    assert.equal(events[0]!.action, ADMIN_AUDIT_ACTIONS.PARTICIPANT_UNMARKED_TEST);
    const metadata = events[0]!.metadata as Record<string, unknown>;
    assert.equal(metadata.from, "TEST");
    assert.equal(metadata.to, "UNKNOWN");
    assert.equal(metadata.reasonCode, "MARKED_TEST_BY_MISTAKE");
  });

  it("refuses record ids starting with TEST", async () => {
    const session = await superAdmin();
    const p = await redcapParticipant("TEST", { studyRecordId: fx.uniqueRecordId("TEST") });
    const result = await unmarkTestParticipant({ userId: p.userId, session, reason: MISTAKE });
    assert.equal(!result.ok && result.message, UNMARK_TEST_DUMMY_RECORD_MESSAGE);
    assert.equal((await fx.getProfile(p.userId)).dataKind, "TEST");
  });

  it("refuses LOCAL and REAL accounts", async () => {
    const session = await superAdmin();
    const local = await fx.createParticipant({
      dataSource: "LOCAL",
      dataKind: "TEST",
      enrollmentDate: PROFILE_DATE,
      studyRecordId: null,
    });
    const real = await redcapParticipant("REAL");
    for (const userId of [local.userId, real.userId]) {
      const result = await unmarkTestParticipant({ userId, session, reason: MISTAKE });
      assert.equal(!result.ok && result.message, UNMARK_TEST_NOT_ELIGIBLE_MESSAGE);
      assert.equal((await fx.getAuditEvents(userId)).length, 0);
    }
  });

  it("rejects an ADMIN session", async () => {
    const admin = await fx.createStaff({ superAdmin: false });
    const p = await redcapParticipant("TEST");
    const result = await unmarkTestParticipant({ userId: p.userId, session: admin, reason: MISTAKE });
    assert.equal(!result.ok && result.error, "forbidden");
  });
});

describe("classification history", () => {
  it("lists this participant's changes newest first", async () => {
    const session = await superAdmin();
    const p = await redcapParticipant("UNKNOWN", { consentDate: CONSENT_DATE });
    assert.equal(
      (await markParticipantAsTest({ userId: p.userId, session, reason: RECORD_IS_TEST })).ok,
      true
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(
      (await unmarkTestParticipant({ userId: p.userId, session, reason: MISTAKE })).ok,
      true
    );

    const history = await getParticipantClassificationHistory(p.userId);
    assert.deepEqual(
      history.map((entry) => entry.action),
      [ADMIN_AUDIT_ACTIONS.PARTICIPANT_UNMARKED_TEST, ADMIN_AUDIT_ACTIONS.PARTICIPANT_MARKED_TEST]
    );
    assert.equal(history[1]!.fromLabel, "Unknown");
    assert.equal(history[1]!.toLabel, "Test");
    assert.equal(history[1]!.reasonLabel, "Record is a test record");
  });
});
