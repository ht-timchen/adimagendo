import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isProtectedFromAutomaticClassification,
  resolveAutomaticParticipantClassification,
} from "./preserve-pilot-classification";

describe("automatic classification keeps manual TEST", () => {
  it("protects REDCap REAL and REDCap TEST profiles", () => {
    assert.equal(isProtectedFromAutomaticClassification({ dataSource: "REDCAP", dataKind: "REAL" }), true);
    assert.equal(isProtectedFromAutomaticClassification({ dataSource: "REDCAP", dataKind: "TEST" }), true);
    assert.equal(isProtectedFromAutomaticClassification({ dataSource: "REDCAP", dataKind: "UNKNOWN" }), false);
    assert.equal(isProtectedFromAutomaticClassification({ dataSource: "LOCAL", dataKind: "TEST" }), false);
    assert.equal(isProtectedFromAutomaticClassification(null), false);
  });

  it("does not reset a REDCap TEST profile to UNKNOWN", () => {
    assert.deepEqual(
      resolveAutomaticParticipantClassification(
        { dataSource: "REDCAP", dataKind: "TEST" },
        { dataSource: "REDCAP", dataKind: "UNKNOWN" }
      ),
      { dataSource: "REDCAP", dataKind: "TEST" }
    );
  });

  it("still lets automatic flows classify REDCap UNKNOWN profiles", () => {
    assert.deepEqual(
      resolveAutomaticParticipantClassification(
        { dataSource: "REDCAP", dataKind: "UNKNOWN" },
        { dataSource: "REDCAP", dataKind: "TEST" }
      ),
      { dataSource: "REDCAP", dataKind: "TEST" }
    );
  });
});
