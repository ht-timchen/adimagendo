import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addCalendarMonths,
  addCivilDays,
  adelaideCivilDate,
  adelaideMidnightUtc,
  civilDaysBetween,
  compareCivilDates,
  formatAdelaideCivilDate,
  formatCivilDateDMY,
} from "./adelaide-calendar";

describe("adelaideCivilDate", () => {
  it("uses the Adelaide calendar date, not UTC", () => {
    // 2026-01-01T14:00Z is 00:30 on 2 Jan in Adelaide (ACDT, UTC+10:30).
    assert.deepEqual(adelaideCivilDate(new Date("2026-01-01T14:00:00Z")), {
      year: 2026,
      month: 1,
      day: 2,
    });
    assert.deepEqual(adelaideCivilDate(new Date("2026-01-01T13:00:00Z")), {
      year: 2026,
      month: 1,
      day: 1,
    });
  });
});

describe("addCalendarMonths", () => {
  it("clamps to the end of shorter months", () => {
    assert.deepEqual(addCalendarMonths({ year: 2026, month: 1, day: 31 }, 1), {
      year: 2026,
      month: 2,
      day: 28,
    });
    assert.deepEqual(addCalendarMonths({ year: 2028, month: 1, day: 31 }, 1), {
      year: 2028,
      month: 2,
      day: 29,
    });
    assert.deepEqual(addCalendarMonths({ year: 2026, month: 8, day: 31 }, 6), {
      year: 2027,
      month: 2,
      day: 28,
    });
    assert.deepEqual(addCalendarMonths({ year: 2028, month: 2, day: 29 }, 12), {
      year: 2029,
      month: 2,
      day: 28,
    });
    assert.deepEqual(addCalendarMonths({ year: 2026, month: 11, day: 30 }, 3), {
      year: 2027,
      month: 2,
      day: 28,
    });
  });

  it("rolls over years for 30 and 36 months", () => {
    assert.deepEqual(addCalendarMonths({ year: 2026, month: 5, day: 15 }, 30), {
      year: 2028,
      month: 11,
      day: 15,
    });
    assert.deepEqual(addCalendarMonths({ year: 2026, month: 5, day: 15 }, 36), {
      year: 2029,
      month: 5,
      day: 15,
    });
  });
});

describe("adelaideMidnightUtc", () => {
  it("returns 00:00 Adelaide in standard time (UTC+9:30)", () => {
    assert.equal(
      adelaideMidnightUtc({ year: 2026, month: 7, day: 1 }).toISOString(),
      "2026-06-30T14:30:00.000Z"
    );
  });

  it("returns 00:00 Adelaide in daylight time (UTC+10:30)", () => {
    assert.equal(
      adelaideMidnightUtc({ year: 2026, month: 1, day: 15 }).toISOString(),
      "2026-01-14T13:30:00.000Z"
    );
  });

  it("handles the DST start and end days", () => {
    // DST starts 2am on 4 Oct 2026; midnight is still standard time.
    assert.equal(
      adelaideMidnightUtc({ year: 2026, month: 10, day: 4 }).toISOString(),
      "2026-10-03T14:30:00.000Z"
    );
    assert.equal(
      adelaideMidnightUtc({ year: 2026, month: 10, day: 5 }).toISOString(),
      "2026-10-04T13:30:00.000Z"
    );
    // DST ends 3am on 5 Apr 2026; midnight is still daylight time.
    assert.equal(
      adelaideMidnightUtc({ year: 2026, month: 4, day: 5 }).toISOString(),
      "2026-04-04T13:30:00.000Z"
    );
    assert.equal(
      adelaideMidnightUtc({ year: 2026, month: 4, day: 6 }).toISOString(),
      "2026-04-05T14:30:00.000Z"
    );
  });
});

describe("civil date helpers", () => {
  it("adds days across month and DST boundaries", () => {
    assert.deepEqual(addCivilDays({ year: 2026, month: 1, day: 1 }, 56), {
      year: 2026,
      month: 2,
      day: 26,
    });
    assert.deepEqual(addCivilDays({ year: 2026, month: 3, day: 30 }, 14), {
      year: 2026,
      month: 4,
      day: 13,
    });
  });

  it("compares and counts days", () => {
    const a = { year: 2026, month: 4, day: 1 };
    const b = { year: 2026, month: 4, day: 16 };
    assert.ok(compareCivilDates(a, b) < 0);
    assert.equal(compareCivilDates(a, { ...a }), 0);
    assert.equal(civilDaysBetween(a, b), 15);
  });

  it("formats en-AU and dd/mm/yyyy", () => {
    assert.equal(formatAdelaideCivilDate({ year: 2026, month: 4, day: 1 }), "1 Apr 2026");
    assert.equal(formatCivilDateDMY({ year: 2026, month: 4, day: 1 }), "01/04/2026");
  });
});
