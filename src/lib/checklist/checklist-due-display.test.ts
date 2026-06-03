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
