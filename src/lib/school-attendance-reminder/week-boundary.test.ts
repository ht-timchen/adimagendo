import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCalendarWeekRange } from "./week-boundary";

describe("school attendance reminder week boundary", () => {
  it("uses Monday through Sunday in local time", () => {
    // Wednesday 2026-06-17
    const reference = new Date(2026, 5, 17, 15, 30, 0);
    const { start, end } = getCalendarWeekRange(reference);

    assert.equal(start.getDay(), 1);
    assert.equal(start.getFullYear(), 2026);
    assert.equal(start.getMonth(), 5);
    assert.equal(start.getDate(), 15);

    assert.equal(end.getDay(), 0);
    assert.equal(end.getFullYear(), 2026);
    assert.equal(end.getMonth(), 5);
    assert.equal(end.getDate(), 21);
  });
});
