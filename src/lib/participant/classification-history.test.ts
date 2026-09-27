import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADMIN_AUDIT_ACTIONS } from "@/lib/admin-audit";
import { toClassificationHistoryEntry } from "./classification-history";

const BASE = {
  id: "evt-1",
  actorName: "Test Super Admin",
  actorRole: "SUPER_ADMIN",
  createdAt: new Date("2026-09-27T01:00:00.000Z"),
};

describe("toClassificationHistoryEntry", () => {
  it("labels a classification change with its Day 0 move", () => {
    const entry = toClassificationHistoryEntry({
      ...BASE,
      action: ADMIN_AUDIT_ACTIONS.PARTICIPANT_MARKED_TEST,
      metadata: {
        field: "dataKind",
        from: "UNKNOWN",
        to: "TEST",
        reasonLabel: "Record is a test record",
        reasonText: null,
        enrollmentDate: {
          from: { date: "2026-03-01", at: "2026-03-01T01:30:00.000Z" },
          to: { date: "2026-01-15", at: "2026-01-15T04:12:00.000Z" },
          changed: true,
        },
      },
    });
    assert.equal(entry.actionLabel, "Marked as test");
    assert.equal(entry.fromLabel, "Unknown");
    assert.equal(entry.toLabel, "Test");
    assert.deepEqual(entry.enrollmentDateChange, { fromLabel: "1 Mar 2026", toLabel: "15 Jan 2026" });
    assert.equal(entry.reasonLabel, "Record is a test record");
    assert.equal(entry.reasonText, null);
    assert.equal(entry.createdAt, "2026-09-27T01:00:00.000Z");
  });

  it("labels a test enrolment date change with Adelaide dates", () => {
    const entry = toClassificationHistoryEntry({
      ...BASE,
      action: ADMIN_AUDIT_ACTIONS.PARTICIPANT_TEST_ENROLLMENT_DATE_CHANGED,
      metadata: {
        field: "enrollmentDate",
        from: { date: "2026-06-22", at: "2026-06-22T02:30:00.000Z" },
        to: { date: "2025-06-22", at: "2025-06-22T02:30:00.000Z" },
        reasonLabel: "Other",
        reasonText: "12-month scenario",
      },
    });
    assert.equal(entry.fromLabel, "22 Jun 2026");
    assert.equal(entry.toLabel, "22 Jun 2025");
    assert.equal(entry.enrollmentDateChange, null);
    assert.equal(entry.reasonText, "12-month scenario");
  });

  it("labels pilot as Pilot and tolerates missing metadata", () => {
    assert.equal(
      toClassificationHistoryEntry({
        ...BASE,
        action: ADMIN_AUDIT_ACTIONS.PARTICIPANT_MARKED_PILOT,
        metadata: { field: "dataKind", from: "UNKNOWN", to: "REAL" },
      }).toLabel,
      "Pilot"
    );
    const empty = toClassificationHistoryEntry({ ...BASE, action: "x", metadata: null });
    assert.equal(empty.fromLabel, "—");
    assert.equal(empty.reasonLabel, "—");
  });
});
