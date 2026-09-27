import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLASSIFICATION_REASON_TEXT_MAX,
  parseClassificationChangeReason,
} from "./classification-change-reason";

describe("parseClassificationChangeReason", () => {
  it("accepts a preset without free text", () => {
    const result = parseClassificationChangeReason("mark_test", { reasonCode: "RECORD_IS_TEST" });
    assert.deepEqual(result, {
      ok: true,
      reason: { code: "RECORD_IS_TEST", label: "Record is a test record", text: null },
    });
  });

  it("keeps optional free text with a preset", () => {
    const result = parseClassificationChangeReason("edit_test_enrollment_date", {
      reasonCode: "TESTING_TIMING",
      reasonText: "  3-month window  ",
    });
    assert.equal(result.ok && result.reason.text, "3-month window");
  });

  it("requires a preset", () => {
    for (const input of [undefined, null, {}, { reasonCode: "" }, { reasonText: "text only" }]) {
      assert.equal(parseClassificationChangeReason("mark_test", input).ok, false);
    }
  });

  it("rejects presets that do not belong to the action", () => {
    assert.equal(
      parseClassificationChangeReason("mark_pilot", { reasonCode: "RECORD_IS_TEST" }).ok,
      false
    );
    assert.equal(parseClassificationChangeReason("mark_test", { reasonCode: "MADE_UP" }).ok, false);
  });

  it("requires free text only for Other", () => {
    assert.equal(parseClassificationChangeReason("mark_test", { reasonCode: "OTHER" }).ok, false);
    assert.equal(
      parseClassificationChangeReason("mark_test", { reasonCode: "OTHER", reasonText: "   " }).ok,
      false
    );
    const ok = parseClassificationChangeReason("mark_test", {
      reasonCode: "OTHER",
      reasonText: "Duplicate record",
    });
    assert.equal(ok.ok && ok.reason.text, "Duplicate record");
  });

  it("limits free text length", () => {
    const result = parseClassificationChangeReason("mark_test", {
      reasonCode: "OTHER",
      reasonText: "x".repeat(CLASSIFICATION_REASON_TEXT_MAX + 1),
    });
    assert.equal(result.ok, false);
  });
});
