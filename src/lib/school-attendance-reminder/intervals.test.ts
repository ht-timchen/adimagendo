import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACTIVE_SCHOOL_ATTENDANCE_REMINDER_INTERVALS,
  REMINDER_TEST_INTERVALS,
  computeReminderDueDates,
} from "./intervals";

describe("school attendance reminder intervals", () => {
  it("uses test intervals in active config", () => {
    assert.equal(
      ACTIVE_SCHOOL_ATTENDANCE_REMINDER_INTERVALS,
      REMINDER_TEST_INTERVALS
    );
  });

  it("schedules initial, first, and second follow-ups from cycle start", () => {
    const cycleStartAt = new Date("2026-06-01T12:00:00.000Z");
    const due = computeReminderDueDates(cycleStartAt);

    assert.equal(
      due.initialDueAt.getTime(),
      cycleStartAt.getTime() + REMINDER_TEST_INTERVALS.initialDueAfterMs
    );
    assert.equal(
      due.firstFollowUpDueAt.getTime(),
      due.initialDueAt.getTime() +
        REMINDER_TEST_INTERVALS.firstFollowUpAfterInitialDueMs
    );
    assert.equal(
      due.secondFollowUpDueAt.getTime(),
      due.firstFollowUpDueAt.getTime() +
        REMINDER_TEST_INTERVALS.secondFollowUpAfterFirstFollowUpMs
    );
  });
});
