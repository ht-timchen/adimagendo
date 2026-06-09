import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertValidParticipantClassification,
  classifyProfileFromStudyRecordId,
  classifyRedcapSyncFromStudyRecordId,
  isDummyRedcapStudyRecordId,
} from "./participant-data-classification";

describe("participant-data-classification", () => {
  it("classifies missing studyRecordId as LOCAL + TEST", () => {
    assert.deepEqual(classifyProfileFromStudyRecordId(null), {
      dataSource: "LOCAL",
      dataKind: "TEST",
    });
  });

  it("classifies REDCap record as REDCAP + UNKNOWN", () => {
    assert.deepEqual(classifyProfileFromStudyRecordId("10"), {
      dataSource: "REDCAP",
      dataKind: "UNKNOWN",
    });
  });

  it("classifies TEST00x as REDCAP + TEST", () => {
    assert.ok(isDummyRedcapStudyRecordId("TEST001"));
    assert.deepEqual(classifyProfileFromStudyRecordId("TEST001"), {
      dataSource: "REDCAP",
      dataKind: "TEST",
    });
    assert.equal(classifyRedcapSyncFromStudyRecordId("TEST002"), "TEST");
  });

  it("rejects LOCAL + REAL", () => {
    assert.throws(
      () => assertValidParticipantClassification("LOCAL", "REAL"),
      /not allowed/
    );
  });
});
