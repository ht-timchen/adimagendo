import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { assertTestDatabase } from "@/lib/test-support/assert-test-database";
import { createClassificationFixtures } from "@/lib/test-support/classification-fixtures";
import { ADMIN_AUDIT_ACTIONS } from "@/lib/admin-audit";
import {
  markParticipantAsPilot,
  markPilotParticipantErrorMessage,
} from "./mark-pilot-participant";

assertTestDatabase();

const fx = createClassificationFixtures("mark-pilot");

after(async () => {
  await fx.cleanup();
});

const PROFILE_DATE = new Date("2026-03-01T01:30:00.000Z");
const CONFIRMED = { reasonCode: "CONFIRMED_PILOT" };

async function redcapParticipant(dataKind: "UNKNOWN" | "TEST" | "REAL") {
  return fx.createParticipant({ dataSource: "REDCAP", dataKind, enrollmentDate: PROFILE_DATE });
}

describe("markParticipantAsPilot", () => {
  it("marks REDCAP + UNKNOWN as REAL and records the audit event", async () => {
    const session = await fx.createStaff({ superAdmin: true });
    const p = await redcapParticipant("UNKNOWN");
    const result = await markParticipantAsPilot({ userId: p.userId, session, reason: CONFIRMED });
    assert.equal(result.ok, true);
    assert.equal((await fx.getProfile(p.userId)).dataKind, "REAL");

    const events = await fx.getAuditEvents(p.userId);
    assert.equal(events.length, 1);
    const event = events[0]!;
    assert.equal(event.action, ADMIN_AUDIT_ACTIONS.PARTICIPANT_MARKED_PILOT);
    assert.equal(event.actorUserId, session.user.id);
    const metadata = event.metadata as Record<string, unknown>;
    assert.equal(metadata.studyRecordId, p.studyRecordId);
    assert.equal(metadata.field, "dataKind");
    assert.equal(metadata.from, "UNKNOWN");
    assert.equal(metadata.to, "REAL");
    assert.equal(metadata.reasonCode, "CONFIRMED_PILOT");
    assert.equal(metadata.reasonText, null);
  });

  it("rejects ADMIN and stale SUPER_ADMIN sessions", async () => {
    const admin = await fx.createStaff({ superAdmin: false });
    const p = await redcapParticipant("UNKNOWN");
    for (const session of [admin, fx.staleSuperAdminSession(admin)]) {
      const result = await markParticipantAsPilot({ userId: p.userId, session, reason: CONFIRMED });
      assert.equal(!result.ok && result.error, "forbidden");
    }
    assert.equal((await fx.getProfile(p.userId)).dataKind, "UNKNOWN");
    assert.equal((await fx.getAuditEvents(p.userId)).length, 0);
  });

  it("requires a reason", async () => {
    const session = await fx.createStaff({ superAdmin: true });
    const p = await redcapParticipant("UNKNOWN");
    for (const reason of [{}, { reasonCode: "OTHER" }, { reasonCode: "TESTING_TIMING" }]) {
      const result = await markParticipantAsPilot({ userId: p.userId, session, reason });
      assert.equal(!result.ok && result.error, "invalid_reason");
    }
    assert.equal((await fx.getProfile(p.userId)).dataKind, "UNKNOWN");
    assert.equal((await fx.getAuditEvents(p.userId)).length, 0);
  });

  it("keeps the existing eligibility rules", async () => {
    const session = await fx.createStaff({ superAdmin: true });
    const test = await redcapParticipant("TEST");
    const real = await redcapParticipant("REAL");
    const local = await fx.createParticipant({
      dataSource: "LOCAL",
      dataKind: "TEST",
      enrollmentDate: PROFILE_DATE,
      studyRecordId: null,
    });

    const testResult = await markParticipantAsPilot({ userId: test.userId, session, reason: CONFIRMED });
    assert.equal(!testResult.ok && testResult.message, markPilotParticipantErrorMessage("not_eligible"));
    const realResult = await markParticipantAsPilot({ userId: real.userId, session, reason: CONFIRMED });
    assert.equal(!realResult.ok && realResult.error, "already_pilot");
    const localResult = await markParticipantAsPilot({ userId: local.userId, session, reason: CONFIRMED });
    assert.equal(!localResult.ok && localResult.error, "not_eligible");

    for (const userId of [test.userId, real.userId, local.userId]) {
      assert.equal((await fx.getAuditEvents(userId)).length, 0);
    }
  });
});
