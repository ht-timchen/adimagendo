/**
 * One-off backfill after BUG-004 (REDCap consent times were parsed as UTC instead
 * of Adelaide time). Copies redcap_participant_sync.enrollmentDate onto
 * ParticipantProfile.enrollmentDate for REDCap-sourced profiles.
 *
 * Run a REDCap sync FIRST, on the fixed code, so the sync table holds corrected values;
 * this script copies whatever the sync table currently contains.
 * Profiles whose Day 0 was set with the admin test-enrolment-date tool are skipped.
 * Each change applied with --apply also writes one AdminAuditEvent (old value, new value,
 * reason) in the same transaction. Dry-run writes nothing.
 *
 * Dry-run by default: prints old and new values and writes nothing.
 * Usage: npx tsx scripts/backfill-enrollment-date-from-redcap-sync.ts [--apply]
 * Not part of any predeploy step; a human runs it deliberately.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { ADMIN_AUDIT_ACTIONS } from "../src/lib/admin-audit";
import {
  adelaideCivilDate,
  formatCivilDateYmd,
} from "../src/lib/dates/adelaide-calendar";
import {
  backfillAuditMetadata,
  overriddenStudyRecordIds,
  planEnrollmentBackfill,
} from "../src/lib/redcap/enrollment-backfill";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const describe = (d: Date) =>
  `${d.toISOString()} (Adelaide ${formatCivilDateYmd(adelaideCivilDate(d))})`;

async function main() {
  const profiles = await prisma.participantProfile.findMany({
    where: { dataSource: "REDCAP" },
    select: { id: true, studyRecordId: true, enrollmentDate: true, dataKind: true },
    orderBy: { studyRecordId: "asc" },
  });

  const recordIds = profiles.flatMap((p) => (p.studyRecordId ? [p.studyRecordId] : []));
  const syncRows = await prisma.redcapParticipantSync.findMany({
    where: { studyRecordId: { in: recordIds } },
    select: { studyRecordId: true, enrollmentDate: true, lastSyncedAt: true },
  });
  const auditEvents = await prisma.adminAuditEvent.findMany({
    where: { action: ADMIN_AUDIT_ACTIONS.PARTICIPANT_TEST_ENROLLMENT_DATE_CHANGED },
    select: { metadata: true },
  });

  const plan = planEnrollmentBackfill(
    profiles,
    syncRows,
    overriddenStudyRecordIds(auditEvents)
  );
  const kindById = new Map(profiles.map((p) => [p.id, p.dataKind]));

  console.log(apply ? "MODE: APPLY (writing changes)" : "MODE: DRY-RUN (nothing is written)");
  if (syncRows.length > 0) {
    const times = syncRows.map((r) => r.lastSyncedAt.getTime());
    console.log(
      `Sync table last synced between ${new Date(Math.min(...times)).toISOString()} and ${new Date(
        Math.max(...times)
      ).toISOString()}. Confirm this is after the BUG-004 fix was deployed.`
    );
  }
  console.log(
    `REDCap profiles: ${profiles.length} | to change: ${plan.changes.length} | already correct: ${plan.unchanged} | skipped: ${plan.skipped.length}\n`
  );

  for (const change of plan.changes) {
    console.log(
      `record ${change.studyRecordId} [${kindById.get(change.profileId)}]\n  old: ${describe(
        change.from
      )}\n  new: ${describe(change.to)}`
    );
  }
  for (const skip of plan.skipped) {
    console.log(`SKIPPED record ${skip.studyRecordId ?? "(none)"}: ${skip.reason}`);
  }

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to write these changes.");
    return;
  }

  let written = 0;
  let raced = 0;
  for (const change of plan.changes) {
    // The update and its audit event commit together. Only write if the value is still
    // what we planned from; otherwise something changed it meanwhile.
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.participantProfile.updateMany({
        where: { id: change.profileId, enrollmentDate: change.from },
        data: { enrollmentDate: change.to },
      });
      if (result.count !== 1) return false;
      await tx.adminAuditEvent.create({
        data: {
          actorUserId: null,
          actorName: "System script (backfill-enrollment-date-from-redcap-sync)",
          actorRole: "SYSTEM",
          action: ADMIN_AUDIT_ACTIONS.PARTICIPANT_ENROLLMENT_DATE_BACKFILLED,
          targetType: "participant",
          targetId: change.studyRecordId,
          metadata: backfillAuditMetadata(change) as Prisma.InputJsonValue,
        },
      });
      return true;
    });
    if (updated) written += 1;
    else raced += 1;
  }
  console.log(
    `\nApplied: ${written} updated (each with an audit event), ${raced} left alone because the value changed meanwhile.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
