export type BackfillProfile = {
  id: string;
  studyRecordId: string | null;
  enrollmentDate: Date;
};

export type BackfillSyncRow = {
  studyRecordId: string;
  enrollmentDate: Date | null;
};

export type BackfillChange = {
  profileId: string;
  studyRecordId: string;
  from: Date;
  to: Date;
};

export type BackfillSkip = {
  studyRecordId: string | null;
  reason: string;
};

export type BackfillPlan = {
  changes: BackfillChange[];
  unchanged: number;
  skipped: BackfillSkip[];
};

/**
 * Plan copying REDCap-sourced profiles' enrollmentDate from the sync table.
 * Profiles whose Day 0 was deliberately set with the admin test-enrolment-date
 * tool are skipped, so the backfill never undoes a timing test setup.
 */
export function planEnrollmentBackfill(
  profiles: readonly BackfillProfile[],
  syncRows: readonly BackfillSyncRow[],
  manuallyOverriddenStudyRecordIds: ReadonlySet<string>
): BackfillPlan {
  const syncByRecord = new Map(syncRows.map((row) => [row.studyRecordId, row]));
  const plan: BackfillPlan = { changes: [], unchanged: 0, skipped: [] };

  for (const profile of profiles) {
    const { studyRecordId } = profile;
    if (!studyRecordId) {
      plan.skipped.push({ studyRecordId: null, reason: "profile has no studyRecordId" });
      continue;
    }
    if (manuallyOverriddenStudyRecordIds.has(studyRecordId)) {
      plan.skipped.push({
        studyRecordId,
        reason: "Day 0 was set with the test enrolment date tool (see audit log)",
      });
      continue;
    }
    const sync = syncByRecord.get(studyRecordId);
    if (!sync) {
      plan.skipped.push({ studyRecordId, reason: "no row in the REDCap sync table" });
      continue;
    }
    if (!sync.enrollmentDate) {
      plan.skipped.push({ studyRecordId, reason: "sync table has no enrollmentDate" });
      continue;
    }
    if (sync.enrollmentDate.getTime() === profile.enrollmentDate.getTime()) {
      plan.unchanged += 1;
      continue;
    }
    plan.changes.push({
      profileId: profile.id,
      studyRecordId,
      from: profile.enrollmentDate,
      to: sync.enrollmentDate,
    });
  }

  return plan;
}

export const BACKFILL_AUDIT_REASON =
  "BUG-004 backfill: REDCap time parsed as Adelaide local";

/** Audit metadata for one applied backfill change (old and new values as ISO instants). */
export function backfillAuditMetadata(change: BackfillChange): Record<string, unknown> {
  return {
    studyRecordId: change.studyRecordId,
    field: "enrollmentDate",
    from: change.from.toISOString(),
    to: change.to.toISOString(),
    reason: BACKFILL_AUDIT_REASON,
  };
}

/** Study record IDs found in audit metadata of test enrolment date changes. */
export function overriddenStudyRecordIds(
  events: readonly { metadata: unknown }[]
): Set<string> {
  const ids = new Set<string>();
  for (const event of events) {
    const metadata = event.metadata;
    if (metadata && typeof metadata === "object" && "studyRecordId" in metadata) {
      const id = (metadata as { studyRecordId?: unknown }).studyRecordId;
      if (typeof id === "string" && id !== "") ids.add(id);
    }
  }
  return ids;
}
