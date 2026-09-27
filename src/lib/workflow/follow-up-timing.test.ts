import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FOLLOW_UP_UNLOCK_MONTHS } from "@/lib/checklist/protocol-timing";
import { evaluateStepAvailability } from "./evaluate-step-availability";
import type { WorkflowChecklistTemplate, WorkflowEvaluationContext } from "./types";

/** 1 Jan 2026, 22:30 Adelaide. */
const ENROLLMENT = new Date("2026-01-01T12:00:00Z");

function template(
  partial: Pick<WorkflowChecklistTemplate, "key" | "title" | "sortOrder"> &
    Partial<WorkflowChecklistTemplate>
): WorkflowChecklistTemplate {
  return {
    prerequisiteKeys: [],
    requiredMilestoneKeys: [],
    unlockOffsetDays: 0,
    unlockOffsetMonths: FOLLOW_UP_UNLOCK_MONTHS[
      partial.key as keyof typeof FOLLOW_UP_UNLOCK_MONTHS
    ] ?? null,
    bookingPrerequisiteKey: null,
    ...partial,
  };
}

/** Mirrors the seeded protocol shape after the follow-up timing migration. */
function seededTemplates(): Map<string, WorkflowChecklistTemplate> {
  const rows: WorkflowChecklistTemplate[] = [
    template({ key: "qol_baseline", title: "Baseline QoL survey", sortOrder: 0 }),
    template({ key: "book_ultrasound", title: "Book ultrasound", sortOrder: 1 }),
    template({ key: "book_mri", title: "Book MRI", sortOrder: 2 }),
    template({ key: "book_bloods", title: "Book blood test", sortOrder: 3 }),
    template({
      key: "pre_tvus_survey",
      title: "Pre-TVUS survey",
      sortOrder: 4,
      bookingPrerequisiteKey: "book_ultrasound",
    }),
    template({
      key: "ultrasound_completed",
      title: "Ultrasound completed",
      sortOrder: 5,
      prerequisiteKeys: ["pre_tvus_survey"],
    }),
    template({
      key: "post_tvus_survey",
      title: "Post-TVUS survey",
      sortOrder: 6,
      prerequisiteKeys: ["ultrasound_completed"],
    }),
    template({
      key: "confirm_blood_test",
      title: "Blood test completed",
      sortOrder: 7,
      prerequisiteKeys: ["book_bloods"],
    }),
    template({
      key: "confirm_mri",
      title: "MRI completed",
      sortOrder: 8,
      prerequisiteKeys: ["book_mri"],
    }),
    template({ key: "qol_3m", title: "3-month survey", sortOrder: 9 }),
    template({ key: "qol_6m", title: "6-month survey", sortOrder: 10 }),
    template({ key: "qol_9m", title: "9-month survey", sortOrder: 11 }),
    template({ key: "qol_12m", title: "12-month survey", sortOrder: 12 }),
    template({ key: "book_ultrasound_3y", title: "Ultrasound (3-year)", sortOrder: 13 }),
    template({ key: "book_mri_3y", title: "MRI (3-year)", sortOrder: 14 }),
    template({ key: "qol_24m", title: "24-month survey", sortOrder: 15 }),
    template({
      key: "ultrasound_3y_completed",
      title: "3-year Ultrasound completed",
      sortOrder: 16,
      bookingPrerequisiteKey: "book_ultrasound_3y",
    }),
    template({
      key: "mri_3y_completed",
      title: "3-year MRI completed",
      sortOrder: 17,
      bookingPrerequisiteKey: "book_mri_3y",
    }),
    template({ key: "qol_36m", title: "36-month survey", sortOrder: 18 }),
  ];
  return new Map(rows.map((t) => [t.key, t]));
}

function context(
  overrides: Partial<WorkflowEvaluationContext> = {}
): WorkflowEvaluationContext {
  return {
    enrollmentDate: ENROLLMENT,
    enrollmentDateMissing: false,
    now: ENROLLMENT,
    templatesByKey: seededTemplates(),
    completedKeys: new Set(),
    bookingProgressByKey: new Map(),
    bookingAppointmentDateTimeByKey: new Map(),
    achievedMilestoneKeys: new Set(),
    milestones: [],
    ...overrides,
  };
}

describe("follow-up calendar-month timing", () => {
  it("opens exactly at 00:00 Adelaide on enrolment + 3 months", () => {
    // 1 Apr 2026 00:00 ACDT = 2026-03-31T13:30Z.
    const before = evaluateStepAvailability(
      "qol_3m",
      context({ now: new Date("2026-03-31T13:29:59Z") })
    );
    assert.equal(before.locked, true);
    assert.deepEqual(before.reasonCodes, ["NOT_YET_OPEN"]);
    assert.deepEqual(before.reasons, ["Available from 1 Apr 2026"]);

    const at = evaluateStepAvailability(
      "qol_3m",
      context({ now: new Date("2026-03-31T13:30:00Z") })
    );
    assert.equal(at.locked, false);
    assert.equal(at.available, true);
  });

  it("uses the Adelaide enrolment date when UTC is still the previous day", () => {
    // 2026-01-31T14:00Z is 1 Feb 00:30 Adelaide, so 3 months → 1 May, not 30 Apr.
    const result = evaluateStepAvailability(
      "qol_3m",
      context({
        enrollmentDate: new Date("2026-01-31T14:00:00Z"),
        now: new Date("2026-04-30T12:00:00Z"),
      })
    );
    assert.equal(result.locked, true);
    assert.deepEqual(result.reasons, ["Available from 1 May 2026"]);
  });

  it("clamps month-end enrolment dates", () => {
    const enrollmentDate = new Date("2025-11-30T02:00:00Z"); // 30 Nov Adelaide
    const result = evaluateStepAvailability(
      "qol_3m",
      context({ enrollmentDate, now: new Date("2026-02-20T00:00:00Z") })
    );
    assert.deepEqual(result.reasons, ["Available from 28 Feb 2026"]);
  });

  it("opens on the right day across the DST start", () => {
    // Enrolled 4 Jul 2026 (ACST); qol_3m opens 4 Oct 2026, the DST start day.
    const enrollmentDate = new Date("2026-07-04T02:00:00Z");
    const before = evaluateStepAvailability(
      "qol_3m",
      context({ enrollmentDate, now: new Date("2026-10-03T14:29:59Z") })
    );
    const at = evaluateStepAvailability(
      "qol_3m",
      context({ enrollmentDate, now: new Date("2026-10-03T14:30:00Z") })
    );
    assert.equal(before.locked, true);
    assert.equal(at.locked, false);
  });

  it("uses each protocol month offset", () => {
    const expected: Record<string, string> = {
      qol_3m: "1 Apr 2026",
      qol_6m: "1 Jul 2026",
      qol_9m: "1 Oct 2026",
      qol_12m: "1 Jan 2027",
      qol_24m: "1 Jan 2028",
      book_ultrasound_3y: "1 Jul 2028",
      book_mri_3y: "1 Jul 2028",
      qol_36m: "1 Jan 2029",
    };
    for (const [key, label] of Object.entries(expected)) {
      const result = evaluateStepAvailability(key, context());
      assert.deepEqual(result.reasons, [`Available from ${label}`], key);
    }
  });

  it("3-year completion items need both 36 months and their booking", () => {
    const early = evaluateStepAvailability(
      "ultrasound_3y_completed",
      context({ now: new Date("2028-08-01T00:00:00Z") })
    );
    assert.deepEqual(early.reasonCodes.sort(), [
      "BOOKING_PREREQUISITE_NOT_MET",
      "NOT_YET_OPEN",
    ]);

    const openNoBooking = evaluateStepAvailability(
      "mri_3y_completed",
      context({ now: new Date("2029-01-02T00:00:00Z") })
    );
    assert.deepEqual(openNoBooking.reasonCodes, ["BOOKING_PREREQUISITE_NOT_MET"]);

    const open = evaluateStepAvailability(
      "mri_3y_completed",
      context({
        now: new Date("2029-01-02T00:00:00Z"),
        bookingProgressByKey: new Map([["book_mri_3y", "CONFIRMED"]]),
      })
    );
    assert.equal(open.available, true);
  });

  it("does not block Level 2 or Level 3 items on incomplete earlier Levels", () => {
    const now = new Date("2029-02-01T00:00:00Z");
    for (const key of ["qol_3m", "qol_6m", "qol_9m", "qol_12m", "qol_24m", "qol_36m"]) {
      const result = evaluateStepAvailability(key, context({ now }));
      assert.equal(result.available, true, `${key}: ${result.reasons.join("; ")}`);
    }
  });

  it("keeps a completed item completed even before its unlock date", () => {
    const result = evaluateStepAvailability(
      "qol_6m",
      context({
        now: new Date("2026-02-01T00:00:00Z"),
        completedKeys: new Set(["qol_6m"]),
      })
    );
    assert.equal(result.completed, true);
    assert.equal(result.locked, false);
    assert.deepEqual(result.reasons, []);
  });

  it("keeps timed items locked when the enrolment date is missing", () => {
    const result = evaluateStepAvailability(
      "qol_3m",
      context({
        enrollmentDate: null,
        enrollmentDateMissing: true,
        now: new Date("2030-01-01T00:00:00Z"),
      })
    );
    assert.equal(result.locked, true);
    assert.deepEqual(result.reasonCodes, ["ENROLLMENT_DATE_MISSING"]);
  });

  it("leaves untimed Level 1 items open when the enrolment date is missing", () => {
    const result = evaluateStepAvailability(
      "qol_baseline",
      context({ enrollmentDate: null, enrollmentDateMissing: true })
    );
    assert.equal(result.available, true);
  });
});

describe("ultrasound chain (unchanged)", () => {
  it("requires booking → Pre-TVUS → ultrasound complete → Post-TVUS in order", () => {
    const appointmentAt = new Date("2026-02-10T00:00:00Z");

    const preLocked = evaluateStepAvailability("pre_tvus_survey", context());
    assert.ok(preLocked.reasonCodes.includes("BOOKING_PREREQUISITE_NOT_MET"));

    const preOpen = evaluateStepAvailability(
      "pre_tvus_survey",
      context({
        bookingProgressByKey: new Map([["book_ultrasound", "BOOKED_EXTERNALLY"]]),
        bookingAppointmentDateTimeByKey: new Map([["book_ultrasound", appointmentAt]]),
      })
    );
    assert.equal(preOpen.available, true);

    const usLocked = evaluateStepAvailability("ultrasound_completed", context());
    assert.equal(usLocked.locked, true);
    const usOpen = evaluateStepAvailability(
      "ultrasound_completed",
      context({ completedKeys: new Set(["pre_tvus_survey"]) })
    );
    assert.equal(usOpen.available, true);

    const postLocked = evaluateStepAvailability(
      "post_tvus_survey",
      context({ completedKeys: new Set(["pre_tvus_survey"]) })
    );
    assert.equal(postLocked.locked, true);
    const postOpen = evaluateStepAvailability(
      "post_tvus_survey",
      context({ completedKeys: new Set(["pre_tvus_survey", "ultrasound_completed"]) })
    );
    assert.equal(postOpen.available, true);
  });
});
