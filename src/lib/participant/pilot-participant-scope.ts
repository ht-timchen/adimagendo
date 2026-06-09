import type { Prisma } from "@prisma/client";
import type { ParticipantDataKind, ParticipantDataSource } from "@prisma/client";
import {
  PARTICIPANT_DATA_KIND,
  PARTICIPANT_DATA_SOURCE,
} from "./participant-classification-values";

export type ParticipantClassificationFilter = "pilot" | "test" | "unknown" | "all";

export const PARTICIPANT_CLASSIFICATION_FILTER_OPTIONS: {
  value: ParticipantClassificationFilter;
  label: string;
}[] = [
  { value: "pilot", label: "Pilot" },
  { value: "test", label: "Test" },
  { value: "unknown", label: "Unknown" },
  { value: "all", label: "All" },
];

/** Real pilot participants: REDCap-linked and explicitly marked REAL. */
export const PILOT_PARTICIPANT_PROFILE_WHERE = {
  dataSource: PARTICIPANT_DATA_SOURCE.REDCAP,
  dataKind: PARTICIPANT_DATA_KIND.REAL,
} as const satisfies Prisma.ParticipantProfileWhereInput;

export function parseParticipantClassificationFilter(
  value: string | undefined
): ParticipantClassificationFilter {
  if (
    value === "pilot" ||
    value === "test" ||
    value === "unknown" ||
    value === "all"
  ) {
    return value;
  }
  return "pilot";
}

export function participantProfileClassificationWhere(
  filter: ParticipantClassificationFilter
): Prisma.ParticipantProfileWhereInput | undefined {
  switch (filter) {
    case "pilot":
      return PILOT_PARTICIPANT_PROFILE_WHERE;
    case "test":
      return {
        OR: [
          {
            dataSource: PARTICIPANT_DATA_SOURCE.LOCAL,
            dataKind: PARTICIPANT_DATA_KIND.TEST,
          },
          {
            dataSource: PARTICIPANT_DATA_SOURCE.REDCAP,
            dataKind: PARTICIPANT_DATA_KIND.TEST,
          },
        ],
      };
    case "unknown":
      return {
        dataSource: PARTICIPANT_DATA_SOURCE.REDCAP,
        dataKind: PARTICIPANT_DATA_KIND.UNKNOWN,
      };
    case "all":
      return undefined;
  }
}

export function pilotParticipantUserWhere(
  filter: ParticipantClassificationFilter
): Prisma.UserWhereInput {
  const profileWhere = participantProfileClassificationWhere(filter);
  return {
    role: "PARTICIPANT",
    ...(profileWhere ? { profile: { is: profileWhere } } : {}),
  };
}

export function isPilotParticipant(
  profile:
    | {
        dataSource: ParticipantDataSource;
        dataKind: ParticipantDataKind;
      }
    | null
    | undefined
): boolean {
  if (!profile) return false;
  return (
    profile.dataSource === PARTICIPANT_DATA_SOURCE.REDCAP &&
    profile.dataKind === PARTICIPANT_DATA_KIND.REAL
  );
}

/** REDCap-linked participants awaiting manual pilot confirmation. */
export function canMarkAsPilotParticipant(
  profile:
    | {
        dataSource: ParticipantDataSource;
        dataKind: ParticipantDataKind;
      }
    | null
    | undefined
): boolean {
  if (!profile) return false;
  return (
    profile.dataSource === PARTICIPANT_DATA_SOURCE.REDCAP &&
    profile.dataKind === PARTICIPANT_DATA_KIND.UNKNOWN
  );
}

export type ParticipantClassificationBadge = {
  label: "Local test" | "REDCap test" | "Unknown" | "Pilot";
  className: string;
};

export function participantClassificationBadge(profile: {
  dataSource: ParticipantDataSource;
  dataKind: ParticipantDataKind;
}): ParticipantClassificationBadge {
  if (
    profile.dataSource === PARTICIPANT_DATA_SOURCE.LOCAL &&
    profile.dataKind === PARTICIPANT_DATA_KIND.TEST
  ) {
    return {
      label: "Local test",
      className:
        "bg-slate-100 text-slate-800 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
    };
  }
  if (
    profile.dataSource === PARTICIPANT_DATA_SOURCE.REDCAP &&
    profile.dataKind === PARTICIPANT_DATA_KIND.TEST
  ) {
    return {
      label: "REDCap test",
      className:
        "bg-violet-100 text-violet-900 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900",
    };
  }
  if (
    profile.dataSource === PARTICIPANT_DATA_SOURCE.REDCAP &&
    profile.dataKind === PARTICIPANT_DATA_KIND.UNKNOWN
  ) {
    return {
      label: "Unknown",
      className:
        "bg-amber-100 text-amber-950 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900",
    };
  }
  if (isPilotParticipant(profile)) {
    return {
      label: "Pilot",
      className:
        "bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900",
    };
  }
  return {
    label: "Unknown",
    className:
      "bg-amber-100 text-amber-950 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900",
  };
}
