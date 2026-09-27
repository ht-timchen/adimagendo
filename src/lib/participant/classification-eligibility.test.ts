import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canMarkAsTestParticipant,
  canUnmarkTestParticipant,
  classificationLockedReason,
} from "./classification-eligibility";
import { canMarkAsPilotParticipant } from "./pilot-participant-scope";

const REDCAP_UNKNOWN = { dataSource: "REDCAP", dataKind: "UNKNOWN", studyRecordId: "27" } as const;
const REDCAP_TEST = { dataSource: "REDCAP", dataKind: "TEST", studyRecordId: "27" } as const;
const REDCAP_DUMMY_TEST = { dataSource: "REDCAP", dataKind: "TEST", studyRecordId: "TEST001" } as const;
const REDCAP_REAL = { dataSource: "REDCAP", dataKind: "REAL", studyRecordId: "4" } as const;
const LOCAL_TEST = { dataSource: "LOCAL", dataKind: "TEST", studyRecordId: null } as const;

describe("classification card eligibility", () => {
  it("offers Mark as test and Mark as pilot only for REDCap Unknown", () => {
    assert.equal(canMarkAsTestParticipant(REDCAP_UNKNOWN), true);
    assert.equal(canMarkAsPilotParticipant(REDCAP_UNKNOWN), true);
    for (const profile of [REDCAP_TEST, REDCAP_DUMMY_TEST, REDCAP_REAL, LOCAL_TEST]) {
      assert.equal(canMarkAsTestParticipant(profile), false);
      assert.equal(canMarkAsPilotParticipant(profile), false);
    }
  });

  it("offers undo only for REDCap test records without a TEST record id", () => {
    assert.equal(canUnmarkTestParticipant(REDCAP_TEST), true);
    for (const profile of [REDCAP_DUMMY_TEST, REDCAP_UNKNOWN, REDCAP_REAL, LOCAL_TEST]) {
      assert.equal(canUnmarkTestParticipant(profile), false);
    }
  });

  it("explains why an account cannot be reclassified", () => {
    assert.match(classificationLockedReason(LOCAL_TEST) ?? "", /Local accounts/);
    assert.match(classificationLockedReason(REDCAP_REAL) ?? "", /Pilot participants/);
    assert.match(classificationLockedReason(REDCAP_DUMMY_TEST) ?? "", /start[s]? with TEST/);
    assert.equal(classificationLockedReason(REDCAP_UNKNOWN), null);
    assert.equal(classificationLockedReason(REDCAP_TEST), null);
  });
});
