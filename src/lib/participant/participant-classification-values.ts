/** Prisma enum values as plain strings (safe at module init / Turbopack). */
export const PARTICIPANT_DATA_SOURCE = {
  LOCAL: "LOCAL",
  REDCAP: "REDCAP",
} as const;

export const PARTICIPANT_DATA_KIND = {
  TEST: "TEST",
  REAL: "REAL",
  UNKNOWN: "UNKNOWN",
} as const;

export type ParticipantDataSourceValue =
  (typeof PARTICIPANT_DATA_SOURCE)[keyof typeof PARTICIPANT_DATA_SOURCE];

export type ParticipantDataKindValue =
  (typeof PARTICIPANT_DATA_KIND)[keyof typeof PARTICIPANT_DATA_KIND];
