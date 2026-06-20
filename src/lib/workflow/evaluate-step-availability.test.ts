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
        unlockOffsetDays: 0,
      }),
    ],
    [
      "qol_12m",
      template({
        key: "qol_12m",
        title: "12-month survey",
        sortOrder: 12,
        prerequisiteKeys: [],
        unlockOffsetDays: 0,
      }),
    ],
    [
      "qol_24m",
      template({
        key: "qol_24m",
        title: "24-month survey",
        sortOrder: 15,
        prerequisiteKeys: [],
        unlockOffsetDays: 0,
      }),
    ],
  ]);

  return {
    enrollmentDate: ENROLLMENT,
    enrollmentDateMissing: false,
    now: new Date("2026-02-01T12:00:00Z"),
    templatesByKey: defaultTemplates,
    completedKeys: new Set(),
    bookingProgressByKey: new Map(),
    bookingAppointmentDateTimeByKey: new Map(),
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

  it("does not lock qol_3m solely by the 90-day offset", () => {
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
        achievedMilestoneKeys: new Set(),
        now: new Date("2026-02-01T12:00:00Z"),
      })
    );

    assert.equal(result.locked, false);
    assert.equal(result.available, true);
    assert.equal(
      result.reasons.some((r) => r.includes("90 days after enrollment")),
      false
    );
  });

  it("locks steps with unlockOffsetDays when enrollment date is missing", () => {
    const templatesByKey = new Map(buildContext().templatesByKey);
    templatesByKey.set(
      "qol_12m",
      template({
        key: "qol_12m",
        title: "12-month survey",
        sortOrder: 12,
        prerequisiteKeys: [],
        unlockOffsetDays: 360,
      })
    );

    const result = evaluateStepAvailability(
      "qol_12m",
      buildContext({
        templatesByKey,
        enrollmentDate: null,
        enrollmentDateMissing: true,
        completedKeys: new Set(),
        now: new Date("2027-06-01T12:00:00Z"),
      })
    );

    assert.equal(result.locked, true);
    assert.ok(
      result.reasons.some((r) => r.includes("Enrollment date is missing")),
      `expected missing enrollment reason, got: ${result.reasons.join("; ")}`
    );
  });

  it("locks step when an explicit required milestone is not achieved", () => {
    const templatesByKey = new Map(buildContext().templatesByKey);
    templatesByKey.set(
      "qol_24m",
      template({
        key: "qol_24m",
        title: "24-month survey",
        sortOrder: 15,
        prerequisiteKeys: [],
        requiredMilestoneKeys: ["level_2_complete"],
        unlockOffsetDays: 0,
      })
    );

    const result = evaluateStepAvailability(
      "qol_24m",
      buildContext({
        templatesByKey,
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
        completedKeys: new Set(),
        achievedMilestoneKeys: new Set(),
        now: new Date("2027-06-01T12:00:00Z"),
      })
    );

    assert.equal(result.locked, false);
    assert.equal(result.available, true);
    assert.equal(
      result.reasons.some((r) => r.includes("milestone")),
      false,
      `should not mention milestones, got: ${result.reasons.join("; ")}`
    );
  });

  it("allows qol_12m without completing earlier Level 2 surveys", () => {
    const result = evaluateStepAvailability(
      "qol_12m",
      buildContext({
        completedKeys: new Set(),
        now: new Date("2027-06-01T12:00:00Z"),
      })
    );

    assert.equal(result.locked, false);
    assert.equal(result.available, true);
    assert.deepEqual(result.reasons, []);
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
        achievedMilestoneKeys: new Set(),
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
        achievedMilestoneKeys: new Set(),
        now: new Date("2026-05-15T12:00:00Z"),
      })
    );

    assert.equal(allMet.completed, false);
    assert.equal(allMet.locked, false);
    assert.equal(allMet.available, true);
    assert.deepEqual(allMet.reasons, []);
  });
});

describe("Level 3 step availability", () => {
  const LEVEL_3_NOW = new Date("2029-06-01T12:00:00Z");

  function buildLevel3Context(
    overrides: Partial<WorkflowEvaluationContext> = {}
  ): WorkflowEvaluationContext {
    const level3Templates = new Map<string, WorkflowChecklistTemplate>([
      [
        "book_ultrasound_3y",
        template({
          key: "book_ultrasound_3y",
          title: "Ultrasound (3-year)",
          sortOrder: 13,
        }),
      ],
      [
        "book_mri_3y",
        template({
          key: "book_mri_3y",
          title: "MRI (3-year)",
          sortOrder: 14,
        }),
      ],
      [
        "qol_24m",
        template({
          key: "qol_24m",
          title: "24-month survey",
          sortOrder: 15,
          prerequisiteKeys: [],
          unlockOffsetDays: 0,
        }),
      ],
      [
        "ultrasound_3y_completed",
        template({
          key: "ultrasound_3y_completed",
          title: "3-year Ultrasound completed",
          sortOrder: 16,
          prerequisiteKeys: [],
          bookingPrerequisiteKey: "book_ultrasound_3y",
          unlockOffsetDays: 0,
        }),
      ],
      [
        "mri_3y_completed",
        template({
          key: "mri_3y_completed",
          title: "3-year MRI completed",
          sortOrder: 17,
          prerequisiteKeys: [],
          bookingPrerequisiteKey: "book_mri_3y",
          unlockOffsetDays: 0,
        }),
      ],
      [
        "qol_36m",
        template({
          key: "qol_36m",
          title: "36-month survey",
          sortOrder: 18,
          prerequisiteKeys: [],
          unlockOffsetDays: 0,
        }),
      ],
    ]);

    return buildContext({
      now: LEVEL_3_NOW,
      templatesByKey: level3Templates,
      completedKeys: new Set(),
      bookingProgressByKey: new Map(),
      ...overrides,
      templatesByKey: overrides.templatesByKey ?? level3Templates,
    });
  }

  it("allows qol_24m, mri_3y_completed, and qol_36m without sibling prerequisites", () => {
    for (const key of ["qol_24m", "mri_3y_completed", "qol_36m"] as const) {
      const result = evaluateStepAvailability(
        key,
        buildLevel3Context({
          bookingProgressByKey: new Map([
            ["book_ultrasound_3y", "CONFIRMED"],
            ["book_mri_3y", "CONFIRMED"],
          ]),
        })
      );

      assert.equal(
        result.locked,
        false,
        `${key} should not be locked by sibling items, got: ${result.reasons.join("; ")}`
      );
      assert.equal(result.available, true, key);
    }
  });

  it("locks mri_3y_completed when book_mri_3y is not booked", () => {
    const result = evaluateStepAvailability(
      "mri_3y_completed",
      buildLevel3Context({
        bookingProgressByKey: new Map([["book_mri_3y", "NOT_STARTED"]]),
      })
    );

    assert.equal(result.locked, true);
    assert.ok(result.reasonCodes.includes("BOOKING_PREREQUISITE_NOT_MET"));
    assert.ok(result.reasons.some((r) => r.includes("Book MRI (3-year)")));
  });

  it("unlocks mri_3y_completed when book_mri_3y is CONFIRMED", () => {
    const result = evaluateStepAvailability(
      "mri_3y_completed",
      buildLevel3Context({
        bookingProgressByKey: new Map([["book_mri_3y", "CONFIRMED"]]),
      })
    );

    assert.equal(result.locked, false);
    assert.equal(result.available, true);
  });

  it("locks ultrasound_3y_completed when book_ultrasound_3y is not booked", () => {
    const result = evaluateStepAvailability(
      "ultrasound_3y_completed",
      buildLevel3Context({
        bookingProgressByKey: new Map([["book_ultrasound_3y", "NOT_STARTED"]]),
      })
    );

    assert.equal(result.locked, true);
    assert.ok(result.reasonCodes.includes("BOOKING_PREREQUISITE_NOT_MET"));
    assert.ok(
      result.reasons.some((r) => r.includes("Book Ultrasound (3-year)"))
    );
  });

  it("unlocks ultrasound_3y_completed when book_ultrasound_3y is BOOKED_EXTERNALLY", () => {
    const result = evaluateStepAvailability(
      "ultrasound_3y_completed",
      buildLevel3Context({
        bookingProgressByKey: new Map([
          ["book_ultrasound_3y", "BOOKED_EXTERNALLY"],
        ]),
      })
    );

    assert.equal(result.locked, false);
    assert.equal(result.available, true);
  });

  it("does not block ultrasound_3y_completed when mri_3y_completed is incomplete", () => {
    const result = evaluateStepAvailability(
      "ultrasound_3y_completed",
      buildLevel3Context({
        bookingProgressByKey: new Map([
          ["book_ultrasound_3y", "CONFIRMED"],
          ["book_mri_3y", "NOT_STARTED"],
        ]),
      })
    );

    assert.equal(result.locked, false);
    assert.equal(result.available, true);
  });

  it("does not block mri_3y_completed when ultrasound_3y_completed is incomplete", () => {
    const result = evaluateStepAvailability(
      "mri_3y_completed",
      buildLevel3Context({
        bookingProgressByKey: new Map([
          ["book_mri_3y", "CONFIRMED"],
          ["book_ultrasound_3y", "NOT_STARTED"],
        ]),
      })
    );

    assert.equal(result.locked, false);
    assert.equal(result.available, true);
  });
});

describe("bookingPrerequisiteKey", () => {
  const SAMPLE_APPOINTMENT_AT = new Date("2026-07-15T10:00:00Z");

  function buildBookingContext(
    bookingProgress: "NOT_STARTED" | "BOOKED_EXTERNALLY" | "CONFIRMED",
    appointmentDateTime: Date | null = null
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
      bookingAppointmentDateTimeByKey: new Map([
        ["book_ultrasound", appointmentDateTime],
      ]),
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
    assert.ok(result.reasons.some((r) => r.includes("Book your ultrasound first")));
  });

  it("locks pre_tvus_survey when book_ultrasound is BOOKED_EXTERNALLY without appointment date/time", () => {
    const result = evaluateStepAvailability(
      "pre_tvus_survey",
      buildBookingContext("BOOKED_EXTERNALLY", null)
    );

    assert.equal(result.locked, true);
    assert.equal(result.available, false);
    assert.ok(result.reasonCodes.includes("BOOKING_PREREQUISITE_NOT_MET"));
    assert.ok(
      result.reasons.some((r) => r.includes("appointment date and time"))
    );
  });

  it("unlocks pre_tvus_survey when book_ultrasound is BOOKED_EXTERNALLY with appointment date/time", () => {
    const result = evaluateStepAvailability(
      "pre_tvus_survey",
      buildBookingContext("BOOKED_EXTERNALLY", SAMPLE_APPOINTMENT_AT)
    );

    assert.equal(result.locked, false);
    assert.equal(result.available, true);
    assert.deepEqual(result.reasonCodes, []);
  });

  it("unlocks pre_tvus_survey when book_ultrasound bookingProgress is CONFIRMED with appointment date/time", () => {
    const result = evaluateStepAvailability(
      "pre_tvus_survey",
      buildBookingContext("CONFIRMED", SAMPLE_APPOINTMENT_AT)
    );

    assert.equal(result.locked, false);
    assert.equal(result.available, true);
    assert.deepEqual(result.reasonCodes, []);
  });
});
