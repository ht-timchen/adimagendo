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
