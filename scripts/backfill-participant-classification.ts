/**
 * Re-apply participant data classification rules (idempotent).
 * Usage: npx tsx scripts/backfill-participant-classification.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  classifyProfileFromStudyRecordId,
  classifyRedcapSyncFromStudyRecordId,
} from "../src/lib/participant/participant-data-classification";
import { isLockedPilotClassification } from "../src/lib/participant/preserve-pilot-classification";

const prisma = new PrismaClient();

async function main() {
  const profiles = await prisma.participantProfile.findMany({
    select: { id: true, studyRecordId: true, dataSource: true, dataKind: true },
  });

  let profileUpdates = 0;
  let profileSkippedLocked = 0;
  for (const profile of profiles) {
    if (isLockedPilotClassification(profile)) {
      profileSkippedLocked += 1;
      continue;
    }
    const next = classifyProfileFromStudyRecordId(profile.studyRecordId);
    if (
      profile.dataSource !== next.dataSource ||
      profile.dataKind !== next.dataKind
    ) {
      await prisma.participantProfile.update({
        where: { id: profile.id },
        data: next,
      });
      profileUpdates += 1;
    }
  }

  const syncRows = await prisma.redcapParticipantSync.findMany({
    select: { id: true, studyRecordId: true, dataKind: true },
  });

  let syncUpdates = 0;
  for (const row of syncRows) {
    const nextKind = classifyRedcapSyncFromStudyRecordId(row.studyRecordId);
    if (row.dataKind !== nextKind) {
      await prisma.redcapParticipantSync.update({
        where: { id: row.id },
        data: { dataKind: nextKind },
      });
      syncUpdates += 1;
    }
  }

  console.log(`Profiles reclassified: ${profileUpdates} of ${profiles.length}`);
  console.log(`Profiles skipped (locked REAL pilot): ${profileSkippedLocked}`);
  console.log(`REDCap sync rows reclassified: ${syncUpdates} of ${syncRows.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
