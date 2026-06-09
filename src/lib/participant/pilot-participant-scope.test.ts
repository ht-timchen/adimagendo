import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canMarkAsPilotParticipant,
  isPilotParticipant,
  parseParticipantClassificationFilter,
  participantClassificationBadge,
} from "./pilot-participant-scope";

describe("pilot-participant-scope", () => {
  it("defaults filter to pilot", () => {
    assert.equal(parseParticipantClassificationFilter(undefined), "pilot");
    assert.equal(parseParticipantClassificationFilter("invalid"), "pilot");
  });

  it("identifies pilot participants", () => {
    assert.equal(
      isPilotParticipant({ dataSource: "REDCAP", dataKind: "REAL" }),
      true
    );
    assert.equal(
      isPilotParticipant({ dataSource: "REDCAP", dataKind: "UNKNOWN" }),
      false
    );
  });

  it("allows marking REDCap unknown as pilot", () => {
    assert.equal(
      canMarkAsPilotParticipant({ dataSource: "REDCAP", dataKind: "UNKNOWN" }),
      true
    );
    assert.equal(
      canMarkAsPilotParticipant({ dataSource: "LOCAL", dataKind: "TEST" }),
      false
    );
  });

  it("renders classification badges", () => {
    assert.equal(
      participantClassificationBadge({ dataSource: "LOCAL", dataKind: "TEST" })
        .label,
      "Local test"
    );
    assert.equal(
      participantClassificationBadge({ dataSource: "REDCAP", dataKind: "TEST" })
        .label,
      "REDCap test"
    );
    assert.equal(
      participantClassificationBadge({
        dataSource: "REDCAP",
        dataKind: "UNKNOWN",
      }).label,
      "Unknown"
    );
    assert.equal(
      participantClassificationBadge({ dataSource: "REDCAP", dataKind: "REAL" })
        .label,
      "Pilot"
    );
  });
});
