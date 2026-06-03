import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateStepAvailability } from "./evaluate-step-availability";
import type { WorkflowChecklistTemplate, WorkflowEvaluationContext } from "./types";

function template(
  partial: WorkflowChecklistTemplate
): WorkflowChecklistTemplate {
  return {
    prerequisiteKeys: [],
    requiredMilestoneKeys: [],
    unlockOffsetDays: 0,
    ...partial,
  };
}

function buildTvusContext(
  completedKeys: Set<string>
): WorkflowEvaluationContext {
  const templatesByKey = new Map<string, WorkflowChecklistTemplate>([
    [
      "book_ultrasound",
      template({ key: "book_ultrasound", title: "Book ultrasound", sortOrder: 1 }),
    ],
    [
      "book_mri",
      template({ key: "book_mri", title: "Book MRI", sortOrder: 2 }),
    ],
    [
      "book_bloods",
      template({ key: "book_bloods", title: "Book blood test", sortOrder: 3 }),
    ],
    [
      "pre_tvus_survey",
      template({
        key: "pre_tvus_survey",
        title: "Pre-TVUS survey",
        sortOrder: 4,
        prerequisiteKeys: ["book_ultrasound"],
      }),
    ],
    [
      "ultrasound_completed",
      template({
        key: "ultrasound_completed",
        title: "Ultrasound completed",
        sortOrder: 5,
        prerequisiteKeys: ["pre_tvus_survey"],
      }),
    ],
    [
      "post_tvus_survey",
      template({
        key: "post_tvus_survey",
        title: "Post-TVUS survey",
        sortOrder: 6,
        prerequisiteKeys: ["ultrasound_completed"],
      }),
    ],
    [
      "confirm_mri",
      template({
        key: "confirm_mri",
        title: "MRI completed",
        sortOrder: 8,
        prerequisiteKeys: ["book_mri"],
      }),
    ],
    [
      "confirm_blood_test",
      template({
        key: "confirm_blood_test",
        title: "Blood test completed",
        sortOrder: 7,
        prerequisiteKeys: ["book_bloods"],
      }),
    ],
  ]);

  return {
    enrollmentDate: new Date("2026-01-01T12:00:00Z"),
    now: new Date("2026-06-01T12:00:00Z"),
    templatesByKey,
    completedKeys,
    achievedMilestoneKeys: new Set(),
    milestones: [],
  };
}

describe("early clinical TVUS workflow", () => {
  it("locks Pre-TVUS when ultrasound is not booked", () => {
    const result = evaluateStepAvailability(
      "pre_tvus_survey",
      buildTvusContext(new Set())
    );
    assert.equal(result.locked, true);
    assert.ok(result.reasons.some((r) => r.includes("Book ultrasound")));
  });

  it("unlocks Pre-TVUS when ultrasound booking is confirmed", () => {
    const result = evaluateStepAvailability(
      "pre_tvus_survey",
      buildTvusContext(new Set(["book_ultrasound"]))
    );
    assert.equal(result.locked, false);
    assert.equal(result.available, true);
  });

  it("unlocks Post-TVUS when ultrasound is completed", () => {
    const result = evaluateStepAvailability(
      "post_tvus_survey",
      buildTvusContext(
        new Set([
          "book_ultrasound",
          "pre_tvus_survey",
          "ultrasound_completed",
        ])
      )
    );
    assert.equal(result.locked, false);
    assert.equal(result.available, true);
  });

  it("unlocks Post-TVUS when MRI and blood are not complete", () => {
    const result = evaluateStepAvailability(
      "post_tvus_survey",
      buildTvusContext(
        new Set([
          "book_ultrasound",
          "pre_tvus_survey",
          "ultrasound_completed",
        ])
      )
    );
    assert.equal(result.available, true);
  });

  it("allows MRI confirmation when only MRI is booked", () => {
    const mri = evaluateStepAvailability(
      "confirm_mri",
      buildTvusContext(new Set(["book_mri"]))
    );
    assert.equal(mri.locked, false);

    const post = evaluateStepAvailability(
      "post_tvus_survey",
      buildTvusContext(new Set(["book_mri", "confirm_mri"]))
    );
    assert.equal(post.locked, true);
  });

  it("allows blood confirmation when only blood is booked", () => {
    const blood = evaluateStepAvailability(
      "confirm_blood_test",
      buildTvusContext(new Set(["book_bloods"]))
    );
    assert.equal(blood.locked, false);

    const post = evaluateStepAvailability(
      "post_tvus_survey",
      buildTvusContext(new Set(["book_bloods", "confirm_blood_test"]))
    );
    assert.equal(post.locked, true);
  });
});
