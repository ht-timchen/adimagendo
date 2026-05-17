import type { Prisma } from "@prisma/client";

export type OverviewTableFilter =
  | "all"
  | "active"
  | "withdrawn"
  | "checklist-incomplete"
  | "checklist-complete";

export const OVERVIEW_TABLE_FILTER_OPTIONS: {
  value: OverviewTableFilter;
  label: string;
}[] = [
  { value: "all", label: "All participants" },
  { value: "active", label: "Active in study" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "checklist-incomplete", label: "Checklist in progress" },
  { value: "checklist-complete", label: "Checklist complete" },
];

export function parseOverviewTableFilter(value?: string): OverviewTableFilter {
  const allowed = OVERVIEW_TABLE_FILTER_OPTIONS.map((o) => o.value);
  if (value && (allowed as string[]).includes(value)) {
    return value as OverviewTableFilter;
  }
  return "all";
}

export function overviewTableFilterLabel(filter: OverviewTableFilter): string {
  return OVERVIEW_TABLE_FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? "All participants";
}

export function participantOverviewTableWhere(
  filter: OverviewTableFilter,
  search?: string
): Prisma.UserWhereInput {
  const parts: Prisma.UserWhereInput[] = [{ role: "PARTICIPANT" }];

  switch (filter) {
    case "active":
      parts.push({ isActive: true });
      break;
    case "withdrawn":
      parts.push({ isActive: false });
      break;
    case "checklist-incomplete":
      parts.push({ checklist: { some: { status: { not: "COMPLETED" } } } });
      break;
    case "checklist-complete":
      parts.push(
        { checklist: { some: {} } },
        { NOT: { checklist: { some: { status: { not: "COMPLETED" } } } } }
      );
      break;
    default:
      break;
  }

  const q = search?.trim();
  if (q) {
    parts.push({
      OR: [
        { name: { contains: q } },
        { email: { contains: q } },
        { profile: { is: { studyRecordId: { contains: q } } } },
      ],
    });
  }

  return { AND: parts };
}
