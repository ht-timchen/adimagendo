import type { Session } from "next-auth";
import type { ParticipantDataKind, ParticipantDataSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hasPermission, type AdminPermission } from "@/lib/admin-rbac";
import {
  adelaideCivilDate,
  formatCivilDateYmd,
} from "@/lib/dates/adelaide-calendar";
import {
  parseClassificationChangeReason,
  type ClassificationChangeAction,
  type ClassificationChangeReason,
  type ClassificationChangeReasonInput,
} from "./classification-change-reason";

export type ParticipantClassificationSnapshot = {
  dataSource: ParticipantDataSource;
  dataKind: ParticipantDataKind;
};

export type ClassificationChangeErrorCode =
  | "forbidden"
  | "feature_disabled"
  | "invalid_reason"
  | "invalid_date"
  | "not_found"
  | "not_participant"
  | "not_eligible"
  | "already_pilot"
  | "conflict"
  | "unchanged";

export type ClassificationChangeFailure = {
  ok: false;
  error: ClassificationChangeErrorCode;
  message: string;
};

export function classificationChangeFailure(
  error: ClassificationChangeErrorCode,
  message: string
): ClassificationChangeFailure {
  return { ok: false, error, message };
}

export function classificationChangeErrorStatus(
  error: ClassificationChangeErrorCode
): number {
  switch (error) {
    case "forbidden":
    case "feature_disabled":
      return 403;
    case "not_found":
    case "not_participant":
      return 404;
    case "conflict":
      return 409;
    default:
      return 400;
  }
}

/**
 * The session role is only refreshed at sign-in, so also confirm the actor is
 * still an active super admin in the database.
 */
export async function isActiveSuperAdminActor(
  session: Session | null | undefined,
  permission: AdminPermission
): Promise<boolean> {
  if (!session?.user?.id || !hasPermission(session, permission)) return false;
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { superAdmin: true, isActive: true },
  });
  return actor?.superAdmin === true && actor.isActive === true;
}

export const FORBIDDEN_MESSAGE = "Only super admins can change participant classification.";

export const CLASSIFICATION_CONFLICT_MESSAGE =
  "This participant changed while you were editing. Refresh and try again.";

/** Thrown inside a transaction when the guarded update matched no row. */
export class ClassificationConflictError extends Error {}

export type ClassificationChangeProfile = {
  id: string;
  studyRecordId: string | null;
  dataSource: ParticipantDataSource;
  dataKind: ParticipantDataKind;
  enrollmentDate: Date;
};

export type LoadedClassificationParticipant =
  | {
      ok: true;
      userId: string;
      profile: ClassificationChangeProfile;
      reason: ClassificationChangeReason;
    }
  | ClassificationChangeFailure;

/** Shared checks for every classification action: actor, reason, target. */
export async function loadParticipantForClassificationChange(input: {
  session: Session;
  userId: string;
  reason: ClassificationChangeReasonInput;
  action: ClassificationChangeAction;
  permission: AdminPermission;
}): Promise<LoadedClassificationParticipant> {
  if (!(await isActiveSuperAdminActor(input.session, input.permission))) {
    return classificationChangeFailure("forbidden", FORBIDDEN_MESSAGE);
  }
  const parsedReason = parseClassificationChangeReason(input.action, input.reason);
  if (!parsedReason.ok) {
    return classificationChangeFailure("invalid_reason", parsedReason.error);
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      role: true,
      profile: {
        select: {
          id: true,
          studyRecordId: true,
          dataSource: true,
          dataKind: true,
          enrollmentDate: true,
        },
      },
    },
  });
  if (!user) return classificationChangeFailure("not_found", "Participant not found.");
  if (user.role !== "PARTICIPANT") {
    return classificationChangeFailure("not_participant", "Participant not found.");
  }
  if (!user.profile) {
    return classificationChangeFailure("not_eligible", "Participant has no study profile.");
  }
  return { ok: true, userId: user.id, profile: user.profile, reason: parsedReason.reason };
}

export type AuditDateValue = { date: string; at: string };

export function auditDateValue(instant: Date): AuditDateValue {
  return {
    date: formatCivilDateYmd(adelaideCivilDate(instant)),
    at: instant.toISOString(),
  };
}

export function classificationAuditMetadata(input: {
  studyRecordId: string | null;
  field: "dataKind" | "enrollmentDate";
  from: unknown;
  to: unknown;
  reason: ClassificationChangeReason;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    studyRecordId: input.studyRecordId,
    field: input.field,
    from: input.from,
    to: input.to,
    reasonCode: input.reason.code,
    reasonLabel: input.reason.label,
    reasonText: input.reason.text,
    ...(input.extra ?? {}),
  };
}
