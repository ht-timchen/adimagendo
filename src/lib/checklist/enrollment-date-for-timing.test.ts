import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLocalTestParticipant,
  isTestParticipantForTiming,
  MISSING_ENROLLMENT_DATE_MESSAGE,
} from "./enrollment-date-for-timing";

describe("enrollment-date-for-timing", () => {
  it("treats LOCAL + TEST as local test participants", () => {
    assert.equal(
      isLocalTestParticipant({ dataSource: "LOCAL", dataKind: "TEST" }),
      true
    );
    assert.equal(
      isLocalTestParticipant({ dataSource: "REDCAP", dataKind: "REAL" }),
      false
    );
  });

  it("treats REDCap TEST as test participants for timing", () => {
    assert.equal(
      isTestParticipantForTiming({ dataSource: "REDCAP", dataKind: "TEST" }),
      true
    );
    assert.equal(
      isTestParticipantForTiming({ dataSource: "REDCAP", dataKind: "REAL" }),
      false
    );
  });

  it("exposes a stable missing-enrollment message", () => {
    assert.match(MISSING_ENROLLMENT_DATE_MESSAGE, /Enrollment date is missing/);
  });
});
