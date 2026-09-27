import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LEVEL_1_REQUIRED_TEMPLATE_KEYS } from "./early-clinical-protocol";
import { isLevel1FollowUpDue, isLevel1Complete } from "./level1-follow-up";

describe("Level 1 follow-up indicator", () => {
  it("shows follow-up when Level 1 incomplete after 56 days", () => {
    const completed = new Set<string>(["qol_baseline", "book_ultrasound"]);
    const due = isLevel1FollowUpDue({
      enrollmentDate: new Date("2026-01-01T12:00:00Z"),
      completedTemplateKeys: completed,
      now: new Date("2026-03-15T12:00:00Z"),
    });
    assert.equal(due, true);
  });

  it("does not show follow-up when Level 1 complete before 56 days", () => {
    const completed = new Set<string>(LEVEL_1_REQUIRED_TEMPLATE_KEYS);
    assert.equal(isLevel1Complete(completed), true);
    const due = isLevel1FollowUpDue({
      enrollmentDate: new Date("2026-01-01T12:00:00Z"),
      completedTemplateKeys: completed,
      now: new Date("2026-06-01T12:00:00Z"),
    });
    assert.equal(due, false);
  });

  it("does not show follow-up when Level 1 complete after 56 days", () => {
    const completed = new Set<string>(LEVEL_1_REQUIRED_TEMPLATE_KEYS);
    const due = isLevel1FollowUpDue({
      enrollmentDate: new Date("2025-01-01T12:00:00Z"),
      completedTemplateKeys: completed,
      now: new Date("2026-06-01T12:00:00Z"),
    });
    assert.equal(due, false);
  });

  it("uses Adelaide calendar dates for the 56-day boundary", () => {
    // Enrolled 1 Jan 2026 (Adelaide); the window ends on 26 Feb, due from 27 Feb Adelaide.
    const params = {
      enrollmentDate: new Date("2026-01-01T12:00:00Z"),
      completedTemplateKeys: new Set<string>(["qol_baseline"]),
    };
    // 26 Feb 23:59 Adelaide (ACDT).
    assert.equal(
      isLevel1FollowUpDue({ ...params, now: new Date("2026-02-26T13:29:00Z") }),
      false
    );
    // 27 Feb 00:00 Adelaide, still 26 Feb in UTC.
    assert.equal(
      isLevel1FollowUpDue({ ...params, now: new Date("2026-02-26T13:30:00Z") }),
      true
    );
  });

  it("stays off on day 8 when only the baseline survey (due at 7 days) is outstanding", () => {
    const completed = new Set<string>(
      LEVEL_1_REQUIRED_TEMPLATE_KEYS.filter((k) => k !== "qol_baseline")
    );
    const due = isLevel1FollowUpDue({
      enrollmentDate: new Date("2026-01-01T12:00:00Z"),
      completedTemplateKeys: completed,
      now: new Date("2026-01-09T02:00:00Z"),
    });
    assert.equal(due, false);
  });

  it("does not show follow-up before 56-day window elapses", () => {
    const completed = new Set<string>(["qol_baseline"]);
    const due = isLevel1FollowUpDue({
      enrollmentDate: new Date("2026-01-01T12:00:00Z"),
      completedTemplateKeys: completed,
      now: new Date("2026-02-01T12:00:00Z"),
    });
    assert.equal(due, false);
  });
});
