import type { ChecklistBookingProgress, ChecklistStatus } from "@prisma/client";

/** Must stay in sync with ADMIN_CHECKLIST_STEP_TOTAL in checklist-progress.ts */
const CHECKLIST_STEP_TOTAL = 19;

export type EnrolmentTokenStatus = "used" | "expired" | "active";

export type JoinStatus =
  | "not_invited"
  | "invited"
  | "expired"
  | "joined"
  | "access_disabled";

export type StudyStatus = "enrolled" | "active" | "completed" | "withdrawn";

export type ChecklistItemForStatus = {
  status: ChecklistStatus;
  bookingProgress: ChecklistBookingProgress;
};

export function deriveTokenStatus(
  usedAt: Date | null,
  expiresAt: Date,
  now: Date = new Date()
): EnrolmentTokenStatus {
  if (usedAt) return "used";
  if (expiresAt < now) return "expired";
  return "active";
}

export function deriveJoinStatus(input: {
  isActive: boolean;
  hasBoundAccount: boolean;
  tokens: { usedAt: Date | null; expiresAt: Date }[];
  now?: Date;
}): JoinStatus {
  if (!input.isActive) return "access_disabled";
  if (input.hasBoundAccount) return "joined";

  const now = input.now ?? new Date();
  const statuses = input.tokens.map((t) =>
    deriveTokenStatus(t.usedAt, t.expiresAt, now)
  );
  if (statuses.includes("active")) return "invited";
  if (statuses.includes("expired")) return "expired";
  return "not_invited";
}

export function hasParticipantChecklistActivity(
  items: ChecklistItemForStatus[],
  hasAppointments: boolean
): boolean {
  if (hasAppointments) return true;
  return items.some(
    (item) =>
      item.status === "COMPLETED" ||
      item.status === "OVERDUE" ||
      item.bookingProgress !== "NOT_STARTED"
  );
}

export function deriveStudyStatus(input: {
  isActive: boolean;
  checklistCompleted: number;
  checklistTotal?: number;
  hasChecklistActivity: boolean;
}): StudyStatus {
  if (!input.isActive) return "withdrawn";
  const total = input.checklistTotal ?? CHECKLIST_STEP_TOTAL;
  if (input.checklistCompleted >= total) return "completed";
  if (input.hasChecklistActivity) return "active";
  return "enrolled";
}

export function countChecklistOverdue(items: { status: ChecklistStatus }[]): number {
  return items.filter((item) => item.status === "OVERDUE").length;
}

export function formatAdminDateDMY(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatAdminDateTimeDMY(
  value: Date | string | null | undefined
): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function joinStatusDisplay(status: JoinStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "not_invited":
      return { label: "Not invited", className: "bg-slate-100 text-slate-700" };
    case "invited":
      return { label: "Invited", className: "bg-sky-100 text-sky-800" };
    case "expired":
      return { label: "Expired", className: "bg-amber-100 text-amber-900" };
    case "joined":
      return { label: "Joined", className: "bg-violet-100 text-violet-800" };
    case "access_disabled":
      return { label: "Access disabled", className: "bg-rose-100 text-rose-800" };
    default:
      return { label: status, className: "bg-slate-100 text-slate-700" };
  }
}

export function studyStatusDisplay(status: StudyStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "enrolled":
      return { label: "Enrolled", className: "bg-slate-100 text-slate-700" };
    case "active":
      return { label: "Active", className: "bg-emerald-100 text-emerald-800" };
    case "completed":
      return { label: "Completed", className: "bg-violet-100 text-violet-800" };
    case "withdrawn":
      return { label: "Withdrawn", className: "bg-slate-200 text-slate-800" };
    default:
      return { label: status, className: "bg-slate-100 text-slate-700" };
  }
}

export function redcapTypeBadge(type: string | null | undefined): {
  label: string;
  className: string;
} {
  if (type === "over18") {
    return { label: "over18", className: "bg-blue-100 text-blue-800" };
  }
  if (type === "u18") {
    return { label: "u18", className: "bg-purple-100 text-purple-800" };
  }
  return { label: type?.trim() || "—", className: "bg-slate-100 text-slate-600" };
}
