import assert from "node:assert/strict";
import test from "node:test";
import { overriddenStudyRecordIds, planEnrollmentBackfill } from "./enrollment-backfill";

const wrong = new Date("2026-04-28T18:54:24.000Z");
const right = new Date("2026-04-28T09:24:24.000Z");
const none = new Set<string>();

test("copies the sync enrollmentDate when it differs", () => {
  const plan = planEnrollmentBackfill(
    [{ id: "p1", studyRecordId: "R1", enrollmentDate: wrong }],
    [{ studyRecordId: "R1", enrollmentDate: right }],
    none
  );
  assert.deepEqual(plan.changes, [
    { profileId: "p1", studyRecordId: "R1", from: wrong, to: right },
  ]);
  assert.equal(plan.unchanged, 0);
  assert.deepEqual(plan.skipped, []);
});

test("counts profiles that already match as unchanged", () => {
  const plan = planEnrollmentBackfill(
    [{ id: "p1", studyRecordId: "R1", enrollmentDate: new Date(right) }],
    [{ studyRecordId: "R1", enrollmentDate: right }],
    none
  );
  assert.equal(plan.changes.length, 0);
  assert.equal(plan.unchanged, 1);
});

test("skips profiles whose Day 0 was set with the test tool", () => {
  const plan = planEnrollmentBackfill(
    [{ id: "p1", studyRecordId: "R1", enrollmentDate: wrong }],
    [{ studyRecordId: "R1", enrollmentDate: right }],
    new Set(["R1"])
  );
  assert.equal(plan.changes.length, 0);
  assert.equal(plan.skipped.length, 1);
  assert.match(plan.skipped[0].reason, /test enrolment date tool/);
});

test("skips missing sync rows, null sync dates and profiles without a record ID", () => {
  const plan = planEnrollmentBackfill(
    [
      { id: "p1", studyRecordId: "R1", enrollmentDate: wrong },
      { id: "p2", studyRecordId: "R2", enrollmentDate: wrong },
      { id: "p3", studyRecordId: null, enrollmentDate: wrong },
    ],
    [{ studyRecordId: "R2", enrollmentDate: null }],
    none
  );
  assert.equal(plan.changes.length, 0);
  assert.deepEqual(
    plan.skipped.map((s) => s.studyRecordId),
    ["R1", "R2", null]
  );
});

test("reads study record IDs from audit metadata and ignores malformed rows", () => {
  const ids = overriddenStudyRecordIds([
    { metadata: { studyRecordId: "4", field: "enrollmentDate" } },
    { metadata: { studyRecordId: "" } },
    { metadata: { studyRecordId: 7 } },
    { metadata: null },
    { metadata: "text" },
  ]);
  assert.deepEqual([...ids], ["4"]);
});
