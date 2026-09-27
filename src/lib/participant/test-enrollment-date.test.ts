import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { assertTestDatabase } from "@/lib/test-support/assert-test-database";
import { createClassificationFixtures } from "@/lib/test-support/classification-fixtures";
import { ADMIN_AUDIT_ACTIONS } from "@/lib/admin-audit";
import { adelaideCivilDate } from "@/lib/dates/adelaide-calendar";
import {
  DAY0_FROM_CONSENT_MESSAGE,
  isTestEnrollmentDateToolsEnabled,
  setTestEnrollmentDate,
  testEnrollmentDateMax,
  testEnrollmentDateToStoredInstant,
} from "./test-enrollment-date";

assertTestDatabase();

const fx = createClassificationFixtures("test-day0");

after(async () => {
  await fx.cleanup();
});

const ENABLED = { ENABLE_TEST_ENROLMENT_DATE_TOOLS: "true" };
const NOW = new Date("2026-09-27T02:00:00.000Z");
const PROFILE_DATE = new Date("2026-06-22T02:30:00.000Z");
const CONSENT_DATE = new Date("2026-01-15T04:12:00.000Z");
const TIMING = { reasonCode: "TESTING_TIMING" };

describe("test enrolment date tools flag", () => {
  it("is off unless ENABLE_TEST_ENROLMENT_DATE_TOOLS is exactly 'true'", () => {
    assert.equal(isTestEnrollmentDateToolsEnabled({}), false);
    assert.equal(isTestEnrollmentDateToolsEnabled({ ENABLE_TEST_ENROLMENT_DATE_TOOLS: "1" }), false);
    assert.equal(isTestEnrollmentDateToolsEnabled({ ENABLE_TEST_ENROLMENT_DATE_TOOLS: "false" }), false);
    assert.equal(isTestEnrollmentDateToolsEnabled(ENABLED), true);
  });
});

describe("stored test Day 0 (12:00 Adelaide)", () => {
  it("stores 12:00 Adelaide time on the chosen date", () => {
    // ACST (UTC+9:30) in June; ACDT (UTC+10:30) in January.
    assert.equal(
      testEnrollmentDateToStoredInstant({ year: 2026, month: 6, day: 22 }).toISOString(),
      "2026-06-22T02:30:00.000Z"
    );
    assert.equal(
      testEnrollmentDateToStoredInstant({ year: 2026, month: 1, day: 15 }).toISOString(),
      "2026-01-15T01:30:00.000Z"
    );
  });

  it("gives the same calendar date under TZ=UTC and TZ=Australia/Adelaide", () => {
    const originalTz = process.env.TZ;
    try {
      for (const tz of ["UTC", "Australia/Adelaide"]) {
        process.env.TZ = tz;
        for (const civil of [
          { year: 2026, month: 6, day: 22 },
          { year: 2026, month: 1, day: 15 },
          { year: 2026, month: 4, day: 5 },
          { year: 2026, month: 10, day: 4 },
        ]) {
          const stored = testEnrollmentDateToStoredInstant(civil);
          assert.deepEqual(adelaideCivilDate(stored), civil, `${tz} adelaideCivilDate`);
          assert.deepEqual(
            {
              year: stored.getFullYear(),
              month: stored.getMonth() + 1,
              day: stored.getDate(),
            },
            civil,
            `${tz} server-local display`
          );
        }
      }
    } finally {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    }
  });

  it("allows dates up to today + 1 year (Adelaide)", () => {
    assert.deepEqual(testEnrollmentDateMax(NOW), { year: 2027, month: 9, day: 27 });
  });
});

async function testParticipant(dataSource: "LOCAL" | "REDCAP") {
  return fx.createParticipant({
    dataSource,
    dataKind: "TEST",
    enrollmentDate: PROFILE_DATE,
    studyRecordId: dataSource === "LOCAL" ? null : undefined,
  });
}

describe("setTestEnrollmentDate: gating", () => {
  it("is rejected when the environment flag is off", async () => {
    const session = await fx.createStaff({ superAdmin: true });
    const p = await testParticipant("LOCAL");
    const result = await setTestEnrollmentDate({
      userId: p.userId,
      session,
      date: "2025-06-22",
      reason: TIMING,
      now: NOW,
      env: {},
    });
    assert.equal(!result.ok && result.error, "feature_disabled");
    assert.equal(
      (await fx.getProfile(p.userId)).enrollmentDate.toISOString(),
      PROFILE_DATE.toISOString()
    );
  });

  it("rejects ADMIN, USER and stale SUPER_ADMIN sessions", async () => {
    const admin = await fx.createStaff({ superAdmin: false });
    const user = await fx.createStaff({ role: "USER", superAdmin: false });
    const p = await testParticipant("LOCAL");
    for (const session of [admin, user, fx.staleSuperAdminSession(admin)]) {
      const result = await setTestEnrollmentDate({
        userId: p.userId,
        session,
        date: "2025-06-22",
        reason: TIMING,
        now: NOW,
        env: ENABLED,
      });
      assert.equal(!result.ok && result.error, "forbidden");
    }
    assert.equal((await fx.getAuditEvents(p.userId)).length, 0);
  });
});

describe("setTestEnrollmentDate: only TEST accounts", () => {
  for (const dataKind of ["UNKNOWN", "REAL"] as const) {
    it(`rejects REDCAP + ${dataKind} with the consent-date message and leaves sync data alone`, async () => {
      const session = await fx.createStaff({ superAdmin: true });
      const p = await fx.createParticipant({
        dataSource: "REDCAP",
        dataKind,
        enrollmentDate: PROFILE_DATE,
      });
      await fx.createSyncRow(p.studyRecordId!, CONSENT_DATE);
      const result = await setTestEnrollmentDate({
        userId: p.userId,
        session,
        date: "2025-06-22",
        reason: TIMING,
        now: NOW,
        env: ENABLED,
      });
      assert.equal(!result.ok && result.message, DAY0_FROM_CONSENT_MESSAGE);
      assert.equal(
        (await fx.getProfile(p.userId)).enrollmentDate.toISOString(),
        PROFILE_DATE.toISOString()
      );
      const sync = await prisma.redcapParticipantSync.findUniqueOrThrow({
        where: { studyRecordId: p.studyRecordId! },
        select: { enrollmentDate: true },
      });
      assert.equal(sync.enrollmentDate?.toISOString(), CONSENT_DATE.toISOString());
      assert.equal((await fx.getAuditEvents(p.userId)).length, 0);
    });
  }

  for (const dataSource of ["LOCAL", "REDCAP"] as const) {
    it(`updates ${dataSource} + TEST and writes one audit event`, async () => {
      const session = await fx.createStaff({ superAdmin: true });
      const p = await testParticipant(dataSource);
      if (p.studyRecordId) await fx.createSyncRow(p.studyRecordId, CONSENT_DATE);

      const result = await setTestEnrollmentDate({
        userId: p.userId,
        session,
        date: "2025-06-22",
        reason: { reasonCode: "OTHER", reasonText: "12-month overdue scenario" },
        now: NOW,
        env: ENABLED,
      });
      assert.equal(result.ok, true);

      const profile = await fx.getProfile(p.userId);
      assert.equal(profile.dataKind, "TEST");
      assert.equal(profile.enrollmentDate.toISOString(), "2025-06-22T02:30:00.000Z");

      if (p.studyRecordId) {
        const sync = await prisma.redcapParticipantSync.findUniqueOrThrow({
          where: { studyRecordId: p.studyRecordId },
          select: { enrollmentDate: true },
        });
        assert.equal(sync.enrollmentDate?.toISOString(), CONSENT_DATE.toISOString());
      }

      const events = await fx.getAuditEvents(p.userId);
      assert.equal(events.length, 1);
      const event = events[0]!;
      assert.equal(event.action, ADMIN_AUDIT_ACTIONS.PARTICIPANT_TEST_ENROLLMENT_DATE_CHANGED);
      assert.equal(event.actorUserId, session.user.id);
      const metadata = event.metadata as Record<string, unknown>;
      assert.equal(metadata.studyRecordId, p.studyRecordId);
      assert.equal(metadata.field, "enrollmentDate");
      assert.deepEqual(metadata.from, { date: "2026-06-22", at: PROFILE_DATE.toISOString() });
      assert.deepEqual(metadata.to, { date: "2025-06-22", at: "2025-06-22T02:30:00.000Z" });
      assert.equal(metadata.reasonCode, "OTHER");
      assert.equal(metadata.reasonText, "12-month overdue scenario");
    });
  }
});

describe("setTestEnrollmentDate: input validation", () => {
  const invalidDates: unknown[] = [
    "2026-02-30",
    "22/06/2026",
    "2019-12-31",
    "2027-09-28",
    "",
    null,
    20260622,
  ];
  for (const date of invalidDates) {
    it(`rejects ${JSON.stringify(date)}`, async () => {
      const session = await fx.createStaff({ superAdmin: true });
      const p = await testParticipant("LOCAL");
      const result = await setTestEnrollmentDate({
        userId: p.userId,
        session,
        date,
        reason: TIMING,
        now: NOW,
        env: ENABLED,
      });
      assert.equal(!result.ok && result.error, "invalid_date");
      assert.equal((await fx.getAuditEvents(p.userId)).length, 0);
    });
  }

  it("accepts the range limits 2020-01-01 and today + 1 year", async () => {
    const session = await fx.createStaff({ superAdmin: true });
    const p = await testParticipant("LOCAL");
    for (const date of ["2020-01-01", "2027-09-27"]) {
      const result = await setTestEnrollmentDate({
        userId: p.userId,
        session,
        date,
        reason: TIMING,
        now: NOW,
        env: ENABLED,
      });
      assert.equal(result.ok, true, date);
    }
  });

  it("rejects the date the account already has", async () => {
    const session = await fx.createStaff({ superAdmin: true });
    const p = await testParticipant("LOCAL");
    const result = await setTestEnrollmentDate({
      userId: p.userId,
      session,
      date: "2026-06-22",
      reason: TIMING,
      now: NOW,
      env: ENABLED,
    });
    assert.equal(!result.ok && result.error, "unchanged");
  });

  it("requires a reason", async () => {
    const session = await fx.createStaff({ superAdmin: true });
    const p = await testParticipant("LOCAL");
    for (const reason of [{}, { reasonCode: "OTHER" }, { reasonCode: "RECORD_IS_TEST" }]) {
      const result = await setTestEnrollmentDate({
        userId: p.userId,
        session,
        date: "2025-06-22",
        reason,
        now: NOW,
        env: ENABLED,
      });
      assert.equal(!result.ok && result.error, "invalid_reason");
    }
    assert.equal((await fx.getAuditEvents(p.userId)).length, 0);
  });
});
