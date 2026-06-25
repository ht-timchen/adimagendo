import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatParticipantProfileDate,
  formatParticipantProfileText,
} from "./participant-profile-display";

describe("formatParticipantProfileText", () => {
  it("returns trimmed text", () => {
    assert.equal(formatParticipantProfileText("  baseline  "), "baseline");
  });

  it("returns Not available for empty values", () => {
    assert.equal(formatParticipantProfileText(null), "Not available");
    assert.equal(formatParticipantProfileText("   "), "Not available");
  });
});

describe("formatParticipantProfileDate", () => {
  it("formats valid dates", () => {
    const formatted = formatParticipantProfileDate(
      new Date("1990-05-15T12:00:00Z")
    );
    assert.notEqual(formatted, "Not available");
    assert.ok(formatted.includes("1990"));
  });

  it("returns Not available for missing or invalid dates", () => {
    assert.equal(formatParticipantProfileDate(null), "Not available");
    assert.equal(formatParticipantProfileDate("not-a-date"), "Not available");
  });
});
