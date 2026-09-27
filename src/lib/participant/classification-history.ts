import { prisma } from "@/lib/db";
import { ADMIN_AUDIT_ACTIONS } from "@/lib/admin-audit";
import {
  formatAdelaideCivilDate,
  parseCivilDateYmd,
} from "@/lib/dates/adelaide-calendar";

export const CLASSIFICATION_HISTORY_ACTIONS = [
  ADMIN_AUDIT_ACTIONS.PARTICIPANT_MARKED_TEST,
  ADMIN_AUDIT_ACTIONS.PARTICIPANT_UNMARKED_TEST,
  ADMIN_AUDIT_ACTIONS.PARTICIPANT_MARKED_PILOT,
  ADMIN_AUDIT_ACTIONS.PARTICIPANT_TEST_ENROLLMENT_DATE_CHANGED,
] as const;

const ACTION_LABELS: Record<string, string> = {
  [ADMIN_AUDIT_ACTIONS.PARTICIPANT_MARKED_TEST]: "Marked as test",
  [ADMIN_AUDIT_ACTIONS.PARTICIPANT_UNMARKED_TEST]: "Changed test back to Unknown",
  [ADMIN_AUDIT_ACTIONS.PARTICIPANT_MARKED_PILOT]: "Marked as pilot",
  [ADMIN_AUDIT_ACTIONS.PARTICIPANT_TEST_ENROLLMENT_DATE_CHANGED]:
    "Test enrolment date changed",
};

const DATA_KIND_LABELS: Record<string, string> = {
  TEST: "Test",
  REAL: "Pilot",
  UNKNOWN: "Unknown",
};

export type ClassificationHistoryEntry = {
  id: string;
  action: string;
  actionLabel: string;
  actorName: string;
  actorRole: string;
  createdAt: string;
  fromLabel: string;
  toLabel: string;
  /** Day 0 change recorded alongside a classification change, when it moved. */
  enrollmentDateChange: { fromLabel: string; toLabel: string } | null;
  reasonLabel: string;
  reasonText: string | null;
};

type AuditEventRow = {
  id: string;
  action: string;
  actorName: string;
  actorRole: string;
  createdAt: Date;
  metadata: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function dateValueLabel(value: unknown): string {
  const ymd = asString(asRecord(value).date);
  const civil = ymd ? parseCivilDateYmd(ymd) : null;
  return civil ? formatAdelaideCivilDate(civil) : "—";
}

function valueLabel(field: string | null, value: unknown): string {
  if (field === "enrollmentDate") return dateValueLabel(value);
  const kind = asString(value);
  return kind ? (DATA_KIND_LABELS[kind] ?? kind) : "—";
}

export function toClassificationHistoryEntry(
  event: AuditEventRow
): ClassificationHistoryEntry {
  const metadata = asRecord(event.metadata);
  const field = asString(metadata.field);
  const dateChange = asRecord(metadata.enrollmentDate);
  return {
    id: event.id,
    action: event.action,
    actionLabel: ACTION_LABELS[event.action] ?? event.action,
    actorName: event.actorName,
    actorRole: event.actorRole,
    createdAt: event.createdAt.toISOString(),
    fromLabel: valueLabel(field, metadata.from),
    toLabel: valueLabel(field, metadata.to),
    enrollmentDateChange:
      dateChange.changed === true
        ? {
            fromLabel: dateValueLabel(dateChange.from),
            toLabel: dateValueLabel(dateChange.to),
          }
        : null,
    reasonLabel: asString(metadata.reasonLabel) ?? "—",
    reasonText: asString(metadata.reasonText),
  };
}

/** Classification and test enrolment date changes for one participant, newest first. */
export async function getParticipantClassificationHistory(
  userId: string,
  options: { take?: number } = {}
): Promise<ClassificationHistoryEntry[]> {
  const events = await prisma.adminAuditEvent.findMany({
    where: {
      targetType: "participant",
      targetId: userId,
      action: { in: [...CLASSIFICATION_HISTORY_ACTIONS] },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: options.take ?? 50,
    select: {
      id: true,
      action: true,
      actorName: true,
      actorRole: true,
      createdAt: true,
      metadata: true,
    },
  });
  return events.map(toClassificationHistoryEntry);
}
