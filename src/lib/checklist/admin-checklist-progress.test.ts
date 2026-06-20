import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChecklistStatus } from "@prisma/client";
import {
  ADMIN_CHECKLIST_STEP_TOTAL,
  computeAdminChecklistProgress,
  computeCohortChecklistCompletionPct,
} from "../admin/checklist-progress";

const ALL_SEED_TEMPLATE_KEYS = [
  "qol_baseline",
  "book_ultrasound",
  "book_mri",
  "book_bloods",
  "pre_tvus_survey",
  "ultrasound_completed",
  "post_tvus_survey",
  "confirm_blood_test",
  "confirm_mri",
  "qol_3m",
  "qol_6m",
  "qol_9m",
  "qol_12m",
  "book_ultrasound_3y",
  "book_mri_3y",
  "qol_24m",
  "ultrasound_3y_completed",
  "mri_3y_completed",
  "qol_36m",
] as const;

function item(key: string, status: ChecklistStatus) {
  return { templateKey: key, status };
}

describe("computeAdminChecklistProgress", () => {
  it("uses 1:1 template counts with total 19 when all templates are present", () => {
    assert.equal(ALL_SEED_TEMPLATE_KEYS.length, ADMIN_CHECKLIST_STEP_TOTAL);

    const allPending = ALL_SEED_TEMPLATE_KEYS.map((key) => item(key, "PENDING"));
    const noneDone = computeAdminChecklistProgress(allPending);
    assert.equal(noneDone.total, 19);
    assert.equal(noneDone.completed, 0);
    assert.equal(noneDone.currentStepName, "Enrolment Survey");

    const allDone = ALL_SEED_TEMPLATE_KEYS.map((key) => item(key, "COMPLETED"));
    const complete = computeAdminChecklistProgress(allDone);
    assert.equal(complete.total, 19);
    assert.equal(complete.completed, 19);
    assert.equal(complete.currentStepName, null);
  });

  it("keeps a human-readable next step while counting templates individually", () => {
    const items = ALL_SEED_TEMPLATE_KEYS.map((key) =>
      item(key, key === "qol_baseline" ? "COMPLETED" : "PENDING")
    );
    const progress = computeAdminChecklistProgress(items);
    assert.equal(progress.completed, 1);
    assert.equal(progress.total, 19);
    assert.equal(progress.currentStepName, "Book ultrasound");
  });
});

describe("computeCohortChecklistCompletionPct", () => {
  it("uses the same raw template completion model in numerator and denominator", () => {
    const allDone = ALL_SEED_TEMPLATE_KEYS.map((key) => item(key, "COMPLETED"));
    const allPending = ALL_SEED_TEMPLATE_KEYS.map((key) => item(key, "PENDING"));

    assert.equal(
      computeCohortChecklistCompletionPct([allDone, allPending]),
      50
    );
    assert.equal(
      computeCohortChecklistCompletionPct([allDone, allDone]),
      100
    );
  });
});
