import type { ParticipantDataKind, ParticipantDataSource } from "@prisma/client";
import { ParticipantDataKind as DataKind, ParticipantDataSource as DataSource } from "@prisma/client";

export const LOCAL_TEST_PROFILE = {
  dataSource: DataSource.LOCAL,
  dataKind: DataKind.TEST,
} as const;

export const REDCAP_UNKNOWN_PROFILE = {
  dataSource: DataSource.REDCAP,
  dataKind: DataKind.UNKNOWN,
} as const;

/** App dummy REDCap record ids such as TEST001 (not real pilot participants). */
export function isDummyRedcapStudyRecordId(
  studyRecordId: string | null | undefined
): boolean {
  if (!studyRecordId?.trim()) return false;
  return studyRecordId.trim().toUpperCase().startsWith("TEST");
}

/** Backfill / legacy classification from studyRecordId only. */
export function classifyProfileFromStudyRecordId(
  studyRecordId: string | null | undefined
): {
  dataSource: ParticipantDataSource;
  dataKind: ParticipantDataKind;
} {
  if (!studyRecordId?.trim()) {
    return { ...LOCAL_TEST_PROFILE };
  }
  if (isDummyRedcapStudyRecordId(studyRecordId)) {
    return { dataSource: DataSource.REDCAP, dataKind: DataKind.TEST };
  }
  return { ...REDCAP_UNKNOWN_PROFILE };
}

export function resolveRedcapProfileClassification(
  syncDataKind: ParticipantDataKind | null | undefined
): {
  dataSource: ParticipantDataSource;
  dataKind: ParticipantDataKind;
} {
  return {
    dataSource: DataSource.REDCAP,
    dataKind: syncDataKind ?? DataKind.UNKNOWN,
  };
}

export function classifyRedcapSyncFromStudyRecordId(
  studyRecordId: string
): ParticipantDataKind {
  return isDummyRedcapStudyRecordId(studyRecordId)
    ? DataKind.TEST
    : DataKind.UNKNOWN;
}

export function assertValidParticipantClassification(
  dataSource: ParticipantDataSource,
  dataKind: ParticipantDataKind
): void {
  if (dataSource === DataSource.LOCAL && dataKind === DataKind.REAL) {
    throw new Error("LOCAL + REAL participant classification is not allowed.");
  }
}

export async function getRedcapSyncDataKind(
  db: {
    redcapParticipantSync: {
      findUnique: (args: {
        where: { studyRecordId: string };
        select: { dataKind: true };
      }) => Promise<{ dataKind: ParticipantDataKind } | null>;
    };
  },
  studyRecordId: string
): Promise<ParticipantDataKind | null> {
  const row = await db.redcapParticipantSync.findUnique({
    where: { studyRecordId },
    select: { dataKind: true },
  });
  return row?.dataKind ?? null;
}
