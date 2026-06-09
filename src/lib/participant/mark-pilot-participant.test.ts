import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canMarkAsPilotParticipant } from "./pilot-participant-scope";
import { markPilotParticipantErrorMessage } from "./mark-pilot-participant";

describe("mark-pilot-participant", () => {
  it("allows REDCap unknown participants only", () => {
    assert.equal(
      canMarkAsPilotParticipant({ dataSource: "REDCAP", dataKind: "UNKNOWN" }),
      true
    );
    assert.equal(
      canMarkAsPilotParticipant({ dataSource: "REDCAP", dataKind: "REAL" }),
      false
    );
    assert.equal(
      canMarkAsPilotParticipant({ dataSource: "REDCAP", dataKind: "TEST" }),
      false
    );
    assert.equal(
      canMarkAsPilotParticipant({ dataSource: "LOCAL", dataKind: "TEST" }),
      false
    );
  });

  it("describes eligibility errors", () => {
    assert.match(
      markPilotParticipantErrorMessage("not_eligible"),
      /Unknown classification/
    );
  });
});
