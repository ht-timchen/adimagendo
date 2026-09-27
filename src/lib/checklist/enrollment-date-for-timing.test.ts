import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLocalTestParticipant,
  isTestParticipantForTiming,
  MISSING_ENROLLMENT_DATE_MESSAGE,
  resolveEnrollmentDateForTiming,
  resolveEnrollmentDatesForTiming,
  type ParticipantProfileTimingFields,
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

describe("batched enrolment date resolver (admin) matches the participant resolver", () => {
  const PROFILE_DATE = new Date("2026-03-01T00:00:00Z");
  const CONSENT_DATE = new Date("2026-01-15T00:00:00Z");

  const consentByRecordId = new Map<string, Date | null>([
    ["R-REAL-SYNCED", CONSENT_DATE],
    ["R-REAL-NO-CONSENT", null],
    ["R-TEST-SYNCED", CONSENT_DATE],
    ["R-UNKNOWN-SYNCED", CONSENT_DATE],
  ]);

  const profiles: { key: string; profile: ParticipantProfileTimingFields }[] = [
    {
      key: "real-synced",
      profile: {
        dataSource: "REDCAP",
        dataKind: "REAL",
        studyRecordId: "R-REAL-SYNCED",
        enrollmentDate: PROFILE_DATE,
      },
    },
    {
      key: "real-no-consent",
      profile: {
        dataSource: "REDCAP",
        dataKind: "REAL",
        studyRecordId: "R-REAL-NO-CONSENT",
        enrollmentDate: PROFILE_DATE,
      },
    },
    {
      key: "real-not-in-sync",
      profile: {
        dataSource: "REDCAP",
        dataKind: "REAL",
        studyRecordId: "R-MISSING-ROW",
        enrollmentDate: PROFILE_DATE,
      },
    },
    {
      key: "redcap-test",
      profile: {
        dataSource: "REDCAP",
        dataKind: "TEST",
        studyRecordId: "R-TEST-SYNCED",
        enrollmentDate: PROFILE_DATE,
      },
    },
    {
      key: "local-test",
      profile: {
        dataSource: "LOCAL",
        dataKind: "TEST",
        studyRecordId: null,
        enrollmentDate: PROFILE_DATE,
      },
    },
    {
      key: "redcap-unknown",
      profile: {
        dataSource: "REDCAP",
        dataKind: "UNKNOWN",
        studyRecordId: "R-UNKNOWN-SYNCED",
        enrollmentDate: PROFILE_DATE,
      },
    },
  ];

  it("returns the same date and missing flag as the single resolver for every profile", async () => {
    const batchCalls: string[][] = [];
    const batched = await resolveEnrollmentDatesForTiming(profiles, {
      getConsentDates: async (ids) => {
        batchCalls.push(ids);
        return new Map(ids.map((id) => [id, consentByRecordId.get(id) ?? null]));
      },
    });

    assert.equal(batchCalls.length, 1);
    assert.deepEqual(batchCalls[0]!.sort(), [
      "R-MISSING-ROW",
      "R-REAL-NO-CONSENT",
      "R-REAL-SYNCED",
      "R-UNKNOWN-SYNCED",
    ]);

    for (const { key, profile } of profiles) {
      const single = await resolveEnrollmentDateForTiming(profile, {
        getConsentDate: async (id) => consentByRecordId.get(id) ?? null,
      });
      assert.deepEqual(batched.get(key), single, key);
    }

    assert.deepEqual(batched.get("real-synced"), {
      enrollmentDate: CONSENT_DATE,
      missing: false,
    });
    assert.deepEqual(batched.get("real-no-consent"), {
      enrollmentDate: null,
      missing: true,
    });
    assert.deepEqual(batched.get("redcap-test"), {
      enrollmentDate: PROFILE_DATE,
      missing: false,
    });
    assert.deepEqual(batched.get("redcap-unknown"), {
      enrollmentDate: CONSENT_DATE,
      missing: false,
    });
  });
});
