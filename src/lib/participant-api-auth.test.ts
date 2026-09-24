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
        isActive: true,
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
        isActive: true,
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
        isActive: true,
      }),
      403
    );
  });

  it("allows enrolled active participants", () => {
    assert.equal(
      evaluateParticipantApiAccess({
        userId: "p1",
        role: "PARTICIPANT",
        isAdmin: false,
        studyRecordId: "REC-001",
        isActive: true,
      }),
      "ok"
    );
  });

  it("returns 403 when the participant session is still valid but User.isActive is false", () => {
    assert.equal(
      evaluateParticipantApiAccess({
        userId: "p1",
        role: "PARTICIPANT",
        isAdmin: false,
        studyRecordId: "REC-001",
        isActive: false,
      }),
      403
    );
  });

  it("returns 403 when User.isActive is missing from the database read", () => {
    assert.equal(
      evaluateParticipantApiAccess({
        userId: "p1",
        role: "PARTICIPANT",
        isAdmin: false,
        studyRecordId: "REC-001",
        isActive: null,
      }),
      403
    );
  });
});
