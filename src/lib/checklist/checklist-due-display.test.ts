import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getChecklistDueDisplay } from "./checklist-due-display";

describe("Post-TVUS recommended due display", () => {
  it("shows recommended date 7 days after ultrasound completion", () => {
    const usDone = new Date("2026-06-01T10:00:00Z");
    const display = getChecklistDueDisplay({
      templateKey: "post_tvus_survey",
      completedAtByKey: new Map([["ultrasound_completed", usDone]]),
    });
    assert.ok(display.recommendedLabel?.includes("Recommended by"));
    assert.ok(display.recommendedLabel?.includes("7 days"));
  });

  it("shows guidance when ultrasound is not yet complete", () => {
    const display = getChecklistDueDisplay({
      templateKey: "post_tvus_survey",
      completedAtByKey: new Map(),
    });
    assert.ok(display.recommendedLabel?.includes("7 days"));
  });
});

describe("Enrollment-based due-by display", () => {
  const enrollmentDate = new Date("2026-01-01T12:00:00Z");

  it("shows due-by date for qol_3m using dueOffsetDays", () => {
    const display = getChecklistDueDisplay({
      templateKey: "qol_3m",
      completedAtByKey: new Map(),
      enrollmentDate,
      dueOffsetDays: 90,
    });
    assert.ok(display.recommendedLabel?.startsWith("Due by"));
    assert.ok(!display.recommendedLabel?.includes("Available from"));
  });

  it("shows missing enrollment message instead of inventing today", () => {
    const display = getChecklistDueDisplay({
      templateKey: "qol_3m",
      completedAtByKey: new Map(),
      enrollmentDate: null,
      dueOffsetDays: 90,
      enrollmentDateMissing: true,
    });
    assert.equal(
      display.recommendedLabel,
      "Enrollment date is missing. Checklist timing cannot be calculated."
    );
  });
});
