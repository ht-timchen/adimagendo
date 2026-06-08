import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateStepAvailability } from "./evaluate-step-availability";
import type { WorkflowChecklistTemplate, WorkflowEvaluationContext } from "./types";

const ENROLLMENT = new Date("2026-01-01T12:00:00Z");

function template(
  partial: WorkflowChecklistTemplate
): WorkflowChecklistTemplate {
  return {
    prerequisiteKeys: [],
    requiredMilestoneKeys: [],
    unlockOffsetDays: 0,
    bookingPrerequisiteKey: null,
    ...partial,
  };
}

function buildContext(
  overrides: Partial<WorkflowEvaluationContext> = {}
): WorkflowEvaluationContext {
  const defaultTemplates = new Map<string, WorkflowChecklistTemplate>([
    [
      "qol_baseline",
      template({
        key: "qol_baseline",
        title: "Baseline QoL survey",
        sortOrder: 0,
      }),
    ],
    [
      "book_ultrasound",
      template({
        key: "book_ultrasound",
        title: "Book ultrasound",
        sortOrder: 1,
        prerequisiteKeys: ["qol_baseline"],
      }),
    ],
    [
      "book_mri",
      template({
        key: "book_mri",
        title: "Book MRI",
        sortOrder: 2,
        prerequisiteKeys: ["qol_baseline"],
      }),
    ],
    [
      "book_bloods",
      template({
        key: "book_bloods",
        title: "Book blood test",
        sortOrder: 3,
        prerequisiteKeys: ["qol_baseline"],
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
      "qol_3m",
      template({
        key: "qol_3m",
        title: "3-month survey",
        sortOrder: 9,
        prerequisiteKeys: ["confirm_blood_test", "confirm_mri"],
        requiredMilestoneKeys: ["level_1_complete"],
        unlockOffsetDays: 90,
      }),
    ],
    [
      "qol_12m",
      template({
        key: "qol_12m",
        title: "12-month survey",
        sortOrder: 12,
        prerequisiteKeys: ["qol_9m"],
        unlockOffsetDays: 360,
      }),
    ],
    [
      "qol_24m",
      template({
        key: "qol_24m",
        title: "24-month survey",
        sortOrder: 13,
        prerequisiteKeys: ["qol_12m"],
        requiredMilestoneKeys: ["level_2_complete"],
        unlockOffsetDays: 730,
      }),
    ],
  ]);

  return {
    enrollmentDate: ENROLLMENT,
    now: new Date("2026-02-01T12:00:00Z"),
    templatesByKey: defaultTemplates,
    completedKeys: new Set(),
    bookingProgressByKey: new Map(),
    achievedMilestoneKeys: new Set(),
    milestones: [
      {
        key: "level_1_complete",
        title: "Level 1 complete",
        sortOrder: 0,
        requiredKeys: [
          "qol_baseline",
          "book_ultrasound",
          "book_mri",
          "book_bloods",
          "confirm_blood_test",
          "confirm_mri",
        ],
      },
      {
        key: "level_2_complete",
        title: "Level 2 complete",
        sortOrder: 1,
        requiredKeys: ["qol_3m", "qol_6m", "qol_9m", "qol_12m"],
      },
    ],
    ...overrides,
    templatesByKey: overrides.templatesByKey ?? defaultTemplates,
  };
}

describe("evaluateStepAvailability", () => {
  it("locks step when a prerequisite is missing", () => {
    const result = evaluateStepAvailability(
      "book_ultrasound",
      buildContext({ completedKeys: new Set() })
    );

    assert.equal(result.completed, false);
    assert.equal(result.locked, true);
    assert.equal(result.available, false);
    assert.ok(
      result.reasons.some((r) => r.includes("Baseline QoL survey")),
      `expected baseline prereq reason, got: ${result.reasons.join("; ")}`
    );
  });

  it("locks step until unlockOffsetDays is reached", () => {
    const result = evaluateStepAvailability(
      "qol_3m",
      buildContext({
        completedKeys: new Set([
          "qol_baseline",
          "book_ultrasound",
          "book_mri",
          "book_bloods",
          "confirm_blood_test",
          "confirm_mri",
        ]),
        achievedMilestoneKeys: new Set(["level_1_complete"]),
        now: new Date("2026-02-01T12:00:00Z"),
      })
    );

    assert.equal(result.locked, true);
    assert.equal(result.available, false);
    assert.ok(
      result.reasons.some((r) => r.includes("90 days after enrollment")),
      `expected time lock reason, got: ${result.reasons.join("; ")}`
    );
  });

  it("locks step when an explicit required milestone is not achieved", () => {
    const result = evaluateStepAvailability(
      "qol_24m",
      buildContext({
        completedKeys: new Set([
          "qol_baseline",
          "book_ultrasound",
          "book_mri",
          "book_bloods",
          "confirm_blood_test",
          "confirm_mri",
          "qol_3m",
          "qol_12m",
        ]),
        achievedMilestoneKeys: new Set(["level_1_complete"]),
        now: new Date("2028-02-01T12:00:00Z"),
      })
    );

    assert.equal(result.locked, true);
    assert.equal(result.available, false);
    assert.ok(
      result.reasons.some((r) => r.includes('Achieve milestone "Level 2 complete" first')),
      `expected milestone reason, got: ${result.reasons.join("; ")}`
    );
  });

  it("does not infer milestone gates from sortOrder when requiredMilestoneKeys is empty", () => {
    const result = evaluateStepAvailability(
      "qol_12m",
      buildContext({
        completedKeys: new Set(["qol_9m"]),
        achievedMilestoneKeys: new Set(),
        now: new Date("2027-06-01T12:00:00Z"),
      })
    );

    assert.equal(
      result.reasons.some((r) => r.includes("milestone")),
      false,
      `should not mention milestones, got: ${result.reasons.join("; ")}`
    );
  });

  it("marks completed step as completed and not available", () => {
    const result = evaluateStepAvailability(
      "qol_baseline",
      buildContext({ completedKeys: new Set(["qol_baseline"]) })
    );

    assert.equal(result.completed, true);
    assert.equal(result.locked, false);
    assert.equal(result.available, false);
    assert.deepEqual(result.reasons, []);
  });

  it("requires all prerequisites when multiple are configured", () => {
    const onlyOne = evaluateStepAvailability(
      "qol_3m",
      buildContext({
        completedKeys: new Set([
          "qol_baseline",
          "book_ultrasound",
          "book_mri",
          "book_bloods",
          "confirm_blood_test",
        ]),
        achievedMilestoneKeys: new Set(["level_1_complete"]),
        now: new Date("2026-05-15T12:00:00Z"),
      })
    );

    assert.equal(onlyOne.locked, true);
    assert.ok(
      onlyOne.reasons.some((r) => r.includes("MRI completed")),
      `expected MRI prereq reason, got: ${onlyOne.reasons.join("; ")}`
    );

    const allMet = evaluateStepAvailability(
      "qol_3m",
      buildContext({
        completedKeys: new Set([
          "qol_baseline",
          "book_ultrasound",
          "book_mri",
          "book_bloods",
          "confirm_blood_test",
          "confirm_mri",
        ]),
        achievedMilestoneKeys: new Set(["level_1_complete"]),
        now: new Date("2026-05-15T12:00:00Z"),
      })
    );

    assert.equal(allMet.completed, false);
    assert.equal(allMet.locked, false);
    assert.equal(allMet.available, true);
    assert.deepEqual(allMet.reasons, []);
  });
});

describe("bookingPrerequisiteKey", () => {
  function buildBookingContext(
    bookingProgress: "NOT_STARTED" | "BOOKED_EXTERNALLY" | "CONFIRMED"
  ) {
    const templatesByKey = new Map<string, WorkflowChecklistTemplate>([
      [
        "book_ultrasound",
        template({
          key: "book_ultrasound",
          title: "Book ultrasound",
          sortOrder: 1,
        }),
      ],
      [
        "pre_tvus_survey",
        template({
          key: "pre_tvus_survey",
          title: "Pre-TVUS survey",
          sortOrder: 4,
          prerequisiteKeys: [],
          bookingPrerequisiteKey: "book_ultrasound",
        }),
      ],
    ]);

    return buildContext({
      templatesByKey,
      bookingProgressByKey: new Map([["book_ultrasound", bookingProgress]]),
    });
  }

  it("locks pre_tvus_survey when book_ultrasound bookingProgress is NOT_STARTED", () => {
    const result = evaluateStepAvailability(
      "pre_tvus_survey",
      buildBookingContext("NOT_STARTED")
    );

    assert.equal(result.locked, true);
    assert.equal(result.available, false);
    assert.ok(result.reasonCodes.includes("BOOKING_PREREQUISITE_NOT_MET"));
    assert.ok(result.reasons.some((r) => r.includes("Book ultrasound")));
  });

  it("unlocks pre_tvus_survey when book_ultrasound bookingProgress is BOOKED_EXTERNALLY", () => {
    const result = evaluateStepAvailability(
      "pre_tvus_survey",
      buildBookingContext("BOOKED_EXTERNALLY")
    );

    assert.equal(result.locked, false);
    assert.equal(result.available, true);
    assert.deepEqual(result.reasonCodes, []);
  });

  it("unlocks pre_tvus_survey when book_ultrasound bookingProgress is CONFIRMED", () => {
    const result = evaluateStepAvailability(
      "pre_tvus_survey",
      buildBookingContext("CONFIRMED")
    );

    assert.equal(result.locked, false);
    assert.equal(result.available, true);
    assert.deepEqual(result.reasonCodes, []);
  });
});
