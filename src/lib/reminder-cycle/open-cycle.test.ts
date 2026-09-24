import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openMedicalCycle, openSchoolCycle } from "./open-cycle";

function adelaide(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Australia/Adelaide",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

describe("open reminder cycles", () => {
  it("opens a school cycle only during the Friday 16:30 Adelaide hour", () => {
    const atR1 = new Date("2026-06-05T07:00:00.000Z");
    const opened = openSchoolCycle(atR1);
    assert.ok(opened);
    assert.equal(opened.periodKey, "school:2026-06-05");
    assert.equal(opened.scheduleVersion, 2);
    assert.equal(adelaide(opened.reminder1At), "Fri, 06/05/2026, 16:30");
    assert.equal(adelaide(opened.reminder2At), "Sat, 06/06/2026, 15:00");
    assert.equal(adelaide(opened.reminder3At), "Sun, 06/07/2026, 15:00");
    assert.equal(adelaide(opened.cycleEndAt), "Mon, 06/08/2026, 00:00");
    assert.equal(openSchoolCycle(new Date("2026-06-05T06:59:00.000Z")), null);
    assert.equal(openSchoolCycle(new Date("2026-06-05T08:00:00.000Z")), null);
    assert.equal(openSchoolCycle(new Date("2026-06-06T05:30:00.000Z")), null);
  });

  it("keeps the school Friday date across both Adelaide DST changes", () => {
    const autumn = openSchoolCycle(new Date("2026-04-03T06:00:00.000Z"));
    assert.ok(autumn);
    assert.equal(autumn.periodKey, "school:2026-04-03");
    assert.ok(autumn.reminder1At < autumn.reminder2At);
    assert.ok(autumn.reminder2At < autumn.reminder3At);
    assert.ok(autumn.reminder3At < autumn.cycleEndAt);
    assert.equal(adelaide(autumn.reminder3At), "Sun, 04/05/2026, 15:00");
    assert.equal(adelaide(autumn.cycleEndAt), "Mon, 04/06/2026, 00:00");

    const spring = openSchoolCycle(new Date("2026-10-02T07:00:00.000Z"));
    assert.ok(spring);
    assert.equal(spring.periodKey, "school:2026-10-02");
    assert.equal(adelaide(spring.reminder1At), "Fri, 10/02/2026, 16:30");
    assert.equal(adelaide(spring.reminder3At), "Sun, 10/04/2026, 15:00");
    assert.equal(adelaide(spring.cycleEndAt), "Mon, 10/05/2026, 00:00");
  });

  it("opens a medical cycle only during the month-end 17:00 Adelaide hour", () => {
    const atR1 = new Date("2026-06-30T07:30:00.000Z");
    const opened = openMedicalCycle(atR1);
    assert.ok(opened);
    assert.equal(opened.periodKey, "medical:2026-06");
    assert.equal(adelaide(opened.reminder1At), "Tue, 06/30/2026, 17:00");
    assert.equal(adelaide(opened.reminder2At), "Wed, 07/01/2026, 17:00");
    assert.equal(adelaide(opened.reminder3At), "Thu, 07/02/2026, 17:00");
    assert.equal(adelaide(opened.cycleEndAt), "Fri, 07/03/2026, 00:00");
    assert.equal(openMedicalCycle(new Date("2026-06-30T08:30:00.000Z")), null);
    assert.equal(openMedicalCycle(new Date("2026-07-01T07:30:00.000Z")), null);
  });
});
