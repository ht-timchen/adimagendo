import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLockedPilotClassification,
  resolveAutomaticParticipantClassification,
} from "./preserve-pilot-classification";

describe("preserve-pilot-classification", () => {
  it("locks REDCap REAL profiles", () => {
    assert.equal(
      isLockedPilotClassification({ dataSource: "REDCAP", dataKind: "REAL" }),
      true
    );
    assert.equal(
      isLockedPilotClassification({ dataSource: "REDCAP", dataKind: "UNKNOWN" }),
      false
    );
    assert.equal(
      isLockedPilotClassification({ dataSource: "LOCAL", dataKind: "TEST" }),
      false
    );
  });

  it("preserves REAL when automatic flow proposes UNKNOWN", () => {
    const existing = { dataSource: "REDCAP" as const, dataKind: "REAL" as const };
    const proposed = { dataSource: "REDCAP" as const, dataKind: "UNKNOWN" as const };
    assert.deepEqual(
      resolveAutomaticParticipantClassification(existing, proposed),
      existing
    );
  });

  it("preserves REAL when automatic flow proposes TEST", () => {
    const existing = { dataSource: "REDCAP" as const, dataKind: "REAL" as const };
    const proposed = { dataSource: "REDCAP" as const, dataKind: "TEST" as const };
    assert.deepEqual(
      resolveAutomaticParticipantClassification(existing, proposed),
      existing
    );
  });

  it("allows classification for non-REAL profiles", () => {
    const proposed = { dataSource: "REDCAP" as const, dataKind: "UNKNOWN" as const };
    assert.deepEqual(
      resolveAutomaticParticipantClassification(
        { dataSource: "REDCAP", dataKind: "UNKNOWN" },
        proposed
      ),
      proposed
    );
    assert.deepEqual(
      resolveAutomaticParticipantClassification(null, proposed),
      proposed
    );
  });
});
