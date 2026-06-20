import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLevel3Complete,
  LEVEL_3_REQUIRED_TEMPLATE_KEYS,
} from "./level2-follow-up";

describe("Level 3 completion", () => {
  it("requires six template keys including 2.5-year bookings", () => {
    assert.equal(LEVEL_3_REQUIRED_TEMPLATE_KEYS.length, 6);
    assert.deepEqual([...LEVEL_3_REQUIRED_TEMPLATE_KEYS], [
      "book_ultrasound_3y",
      "book_mri_3y",
      "qol_24m",
      "ultrasound_3y_completed",
      "mri_3y_completed",
      "qol_36m",
    ]);
  });

  it("does not complete Level 3 when only the four non-booking items are done", () => {
    const completed = new Set<string>([
      "qol_24m",
      "ultrasound_3y_completed",
      "mri_3y_completed",
      "qol_36m",
    ]);
    assert.equal(isLevel3Complete(completed), false);
  });

  it("does not complete Level 3 when one 2.5-year booking is missing", () => {
    const completed = new Set<string>([
      "book_ultrasound_3y",
      "qol_24m",
      "ultrasound_3y_completed",
      "mri_3y_completed",
      "qol_36m",
    ]);
    assert.equal(isLevel3Complete(completed), false);
  });

  it("completes Level 3 only when all six required keys are done", () => {
    const completed = new Set<string>(LEVEL_3_REQUIRED_TEMPLATE_KEYS);
    assert.equal(isLevel3Complete(completed), true);
  });
});
