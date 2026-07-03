import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACTIVE_MEDICAL_APPOINTMENTS_REMINDER_INTERVALS,
  PRODUCTION_MEDICAL_APPOINTMENTS_REMINDER_INTERVALS,
  computeReminderDueDates,
} from "./intervals";

function adelaideWallClock(date: Date): {
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Australia/Adelaide",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

describe("medical appointments reminder intervals", () => {
  it("uses production Adelaide intervals in active config", () => {
    assert.equal(
      ACTIVE_MEDICAL_APPOINTMENTS_REMINDER_INTERVALS,
      PRODUCTION_MEDICAL_APPOINTMENTS_REMINDER_INTERVALS
    );
  });

  it("schedules month-end and +1d/+2d at 5pm Adelaide for June 2026", () => {
    const cycleStartAt = new Date("2026-06-01T12:00:00.000Z");
    const due = computeReminderDueDates(cycleStartAt);

    const initial = adelaideWallClock(due.initialDueAt);
    const firstFollowUp = adelaideWallClock(due.firstFollowUpDueAt);
    const secondFollowUp = adelaideWallClock(due.secondFollowUpDueAt);

    assert.equal(initial.month, 6);
    assert.equal(initial.day, 30);
    assert.equal(initial.hour, 17);
    assert.equal(initial.minute, 0);

    assert.equal(firstFollowUp.month, 7);
    assert.equal(firstFollowUp.day, 1);
    assert.equal(firstFollowUp.hour, 17);
    assert.equal(firstFollowUp.minute, 0);

    assert.equal(secondFollowUp.month, 7);
    assert.equal(secondFollowUp.day, 2);
    assert.equal(secondFollowUp.hour, 17);
    assert.equal(secondFollowUp.minute, 0);

    assert.ok(due.initialDueAt < due.firstFollowUpDueAt);
    assert.ok(due.firstFollowUpDueAt < due.secondFollowUpDueAt);
  });

  it("schedules Feb 29, Mar 1, Mar 2 at 5pm Adelaide for February 2024 (leap year)", () => {
    const cycleStartAt = new Date("2024-02-15T12:00:00.000Z");
    const due = computeReminderDueDates(cycleStartAt);

    const initial = adelaideWallClock(due.initialDueAt);
    const firstFollowUp = adelaideWallClock(due.firstFollowUpDueAt);
    const secondFollowUp = adelaideWallClock(due.secondFollowUpDueAt);

    assert.equal(initial.month, 2);
    assert.equal(initial.day, 29);
    assert.equal(initial.hour, 17);
    assert.equal(initial.minute, 0);

    assert.equal(firstFollowUp.month, 3);
    assert.equal(firstFollowUp.day, 1);
    assert.equal(firstFollowUp.hour, 17);
    assert.equal(firstFollowUp.minute, 0);

    assert.equal(secondFollowUp.month, 3);
    assert.equal(secondFollowUp.day, 2);
    assert.equal(secondFollowUp.hour, 17);
    assert.equal(secondFollowUp.minute, 0);

    assert.ok(due.initialDueAt < due.firstFollowUpDueAt);
    assert.ok(due.firstFollowUpDueAt < due.secondFollowUpDueAt);
  });

  it("schedules Feb 28, Mar 1, Mar 2 at 5pm Adelaide for February 2025 (non-leap year)", () => {
    const cycleStartAt = new Date("2025-02-15T12:00:00.000Z");
    const due = computeReminderDueDates(cycleStartAt);

    const initial = adelaideWallClock(due.initialDueAt);
    const firstFollowUp = adelaideWallClock(due.firstFollowUpDueAt);
    const secondFollowUp = adelaideWallClock(due.secondFollowUpDueAt);

    assert.equal(initial.month, 2);
    assert.equal(initial.day, 28);
    assert.equal(initial.hour, 17);
    assert.equal(initial.minute, 0);

    assert.equal(firstFollowUp.month, 3);
    assert.equal(firstFollowUp.day, 1);
    assert.equal(firstFollowUp.hour, 17);
    assert.equal(firstFollowUp.minute, 0);

    assert.equal(secondFollowUp.month, 3);
    assert.equal(secondFollowUp.day, 2);
    assert.equal(secondFollowUp.hour, 17);
    assert.equal(secondFollowUp.minute, 0);

    assert.ok(due.initialDueAt < due.firstFollowUpDueAt);
    assert.ok(due.firstFollowUpDueAt < due.secondFollowUpDueAt);
  });
});
