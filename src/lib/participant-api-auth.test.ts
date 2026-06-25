import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateParticipantApiAccess } from "@/lib/participant-api-auth";

describe("evaluateParticipantApiAccess", () => {
  it("returns 401 when unauthenticated", () => {
    assert.equal(
      evaluateParticipantApiAccess({
        userId: null,
        role: null,
        isAdmin: false,
        studyRecordId: null,
      }),
      401
    );
  });

  it("returns 403 for participant without studyRecordId", () => {
    assert.equal(
      evaluateParticipantApiAccess({
        userId: "u1",
        role: "PARTICIPANT",
        isAdmin: false,
        studyRecordId: null,
      }),
      403
    );
  });

  it("returns 403 for admin users on participant APIs", () => {
    assert.equal(
      evaluateParticipantApiAccess({
        userId: "a1",
        role: "ADMIN",
        isAdmin: true,
        studyRecordId: "REC-001",
      }),
      403
    );
  });

  it("allows enrolled participants", () => {
    assert.equal(
      evaluateParticipantApiAccess({
        userId: "p1",
        role: "PARTICIPANT",
        isAdmin: false,
        studyRecordId: "REC-001",
      }),
      "ok"
    );
  });
});
