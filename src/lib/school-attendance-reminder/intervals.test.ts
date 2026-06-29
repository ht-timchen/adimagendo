import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACTIVE_SCHOOL_ATTENDANCE_REMINDER_INTERVALS,
  PRODUCTION_SCHOOL_ATTENDANCE_REMINDER_INTERVALS,
  computeReminderDueDates,
} from "./intervals";

function adelaideWallClock(date: Date): {
  weekday: string;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Australia/Adelaide",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

describe("school attendance reminder intervals", () => {
  it("uses production Adelaide intervals in active config", () => {
    assert.equal(
      ACTIVE_SCHOOL_ATTENDANCE_REMINDER_INTERVALS,
      PRODUCTION_SCHOOL_ATTENDANCE_REMINDER_INTERVALS
    );
  });

  it("schedules Fri 5pm, Sat 3pm, Sun 3pm Adelaide for the cycle week", () => {
    const cycleStartAt = new Date("2026-06-01T12:00:00.000Z");
    const due = computeReminderDueDates(cycleStartAt);

    const initial = adelaideWallClock(due.initialDueAt);
    const firstFollowUp = adelaideWallClock(due.firstFollowUpDueAt);
    const secondFollowUp = adelaideWallClock(due.secondFollowUpDueAt);

    assert.equal(initial.weekday, "Fri");
    assert.equal(initial.hour, 17);
    assert.equal(initial.minute, 0);

    assert.equal(firstFollowUp.weekday, "Sat");
    assert.equal(firstFollowUp.hour, 15);
    assert.equal(firstFollowUp.minute, 0);

    assert.equal(secondFollowUp.weekday, "Sun");
    assert.equal(secondFollowUp.hour, 15);
    assert.equal(secondFollowUp.minute, 0);

    assert.ok(due.initialDueAt < due.firstFollowUpDueAt);
    assert.ok(due.firstFollowUpDueAt < due.secondFollowUpDueAt);
  });
});
