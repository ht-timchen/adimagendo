import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCalendarMonthRange,
  getLastDayOfMonth,
} from "./month-boundary";

describe("medical appointments reminder month boundary", () => {
  it("returns 29 for February in a leap year", () => {
    assert.equal(getLastDayOfMonth(2024, 2), 29);
  });

  it("returns 28 for February in a non-leap year", () => {
    assert.equal(getLastDayOfMonth(2025, 2), 28);
  });

  it("returns 31 for January", () => {
    assert.equal(getLastDayOfMonth(2026, 1), 31);
  });

  it("returns 30 for April", () => {
    assert.equal(getLastDayOfMonth(2026, 4), 30);
  });

  it("returns 30 for June", () => {
    assert.equal(getLastDayOfMonth(2026, 6), 30);
  });

  it("returns UTC midnight boundaries for the month containing a mid-month date", () => {
    const reference = new Date(Date.UTC(2026, 5, 15, 12, 30, 0));
    const { start, end } = getCalendarMonthRange(reference);

    assert.equal(start.toISOString(), "2026-06-01T00:00:00.000Z");
    assert.equal(end.toISOString(), "2026-06-30T00:00:00.000Z");
  });
});
