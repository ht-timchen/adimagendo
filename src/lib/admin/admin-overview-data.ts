import { prisma } from "@/lib/db";
import type {
  AdminOverviewDashboardData,
  RangeKey,
} from "@/components/admin/clinical-admin-overview-dashboard";
import {
  displayStudyRecordId,
  lastActiveTimestamp,
} from "@/lib/admin-display";
import {
  parseOverviewTableFilter,
  participantOverviewTableWhere,
} from "@/lib/admin-overview-table-filter";
import {
  ADMIN_CHECKLIST_STEP_TOTAL,
  computeAdminChecklistProgress,
  computeCohortChecklistCompletionPct,
} from "@/lib/admin/checklist-progress";
import {
  getValidChecklistTemplateIds,
  getSurveyChecklistTemplateIds,
} from "@/lib/valid-checklist-items";

/**
 * Data loading for the admin overview page (src/app/(dashboard)/dashboard/admin/page.tsx).
 * Lives here, not in the page module, so it is an ordinary module the page and tests can both
 * import — a Next.js page.tsx is only supposed to export the route's own surface (the default
 * export, plus the framework's own recognized names), not arbitrary test-only exports.
 */

export const COHORT_TARGET = Number(process.env.NEXT_PUBLIC_COHORT_TARGET ?? "400") || 400;

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "3m", label: "Last 3 months" },
  { key: "6m", label: "Last 6 months" },
  { key: "12m", label: "Last 12 months" },
  { key: "all", label: "All time" },
];

function parseRangeKey(v: string | undefined): RangeKey {
  const allowed: RangeKey[] = ["7d", "30d", "3m", "6m", "12m", "all"];
  if (v && allowed.includes(v as RangeKey)) return v as RangeKey;
  return "30d";
}

function rangeLabel(key: RangeKey): string {
  return RANGE_OPTIONS.find((x) => x.key === key)?.label ?? key;
}

function chartRangeShort(key: RangeKey): string {
  switch (key) {
    case "7d":
      return "7d";
    case "30d":
      return "30d";
    case "3m":
      return "3 mo";
    case "6m":
      return "6 mo";
    case "12m":
      return "12 mo";
    case "all":
      return "All";
    default:
      return key;
  }
}

function getRangeBounds(key: RangeKey, now: Date): { from: Date; to: Date } {
  const to = new Date(now);
  const from = new Date(now);
  switch (key) {
    case "7d":
      from.setDate(from.getDate() - 7);
      break;
    case "30d":
      from.setDate(from.getDate() - 30);
      break;
    case "3m":
      from.setMonth(from.getMonth() - 3);
      break;
    case "6m":
      from.setMonth(from.getMonth() - 6);
      break;
    case "12m":
      from.setMonth(from.getMonth() - 12);
      break;
    case "all":
      from.setFullYear(2000);
      break;
    default:
      from.setDate(from.getDate() - 30);
  }
  return { from, to };
}

export async function earliestActivityStart(): Promise<Date | null> {
  const surveyChecklistTemplateIds = await getSurveyChecklistTemplateIds();
  const [s, r, a] = await Promise.all([
    prisma.symptomEntry.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
    // "r" = earliest SURVEY checklist step an app user has marked complete (not a REDCap-verified
    // submission). completedAt is excluded when null so a row without one can't be mistaken for
    // the earliest date — see ParticipantChecklistItem.completedAt.
    prisma.participantChecklistItem.findFirst({
      where: {
        templateId: { in: surveyChecklistTemplateIds },
        status: "COMPLETED",
        completedAt: { not: null },
      },
      orderBy: { completedAt: "asc" },
      select: { completedAt: true },
    }),
    prisma.appointment.findFirst({ orderBy: { startAt: "asc" }, select: { startAt: true } }),
  ]);
  const dates = [s?.date, r?.completedAt, a?.startAt].filter((d): d is Date => d instanceof Date);
  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}

export async function loadDashboardData(
  sp: { range?: string; page?: string; filter?: string; q?: string },
  now: Date
): Promise<AdminOverviewDashboardData> {
  const rangeKey = parseRangeKey(sp.range);
  const bounds = getRangeBounds(rangeKey, now);
  let from = bounds.from;
  const to = bounds.to;
  if (rangeKey === "all") {
    const minD = await earliestActivityStart();
    if (minD) from = minD;
  }

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 10;
  const tableFilter = parseOverviewTableFilter(sp.filter);
  const tableSearch = sp.q?.trim() ?? "";
  const validTemplateIds = await getValidChecklistTemplateIds();
  // Count unit for all survey stats below: SURVEY-type ChecklistTemplate ids. A completed row
  // means the participant marked that checklist step done in the app — not a REDCap-verified
  // survey submission.
  const surveyChecklistTemplateIds = await getSurveyChecklistTemplateIds();
  let tableWhere = participantOverviewTableWhere(tableFilter, tableSearch);
  const checklistScope =
    validTemplateIds.length > 0
      ? { templateId: { in: validTemplateIds } }
      : { templateId: { in: [] as string[] } };

  if (
    tableFilter === "checklist-complete" ||
    tableFilter === "checklist-incomplete"
  ) {
    const completedRows =
      validTemplateIds.length === 0
        ? []
        : await prisma.participantChecklistItem.findMany({
            where: {
              templateId: { in: validTemplateIds },
              status: "COMPLETED",
            },
            select: { userId: true },
          });

    const completedCountByUser = new Map<string, number>();
    for (const row of completedRows) {
      completedCountByUser.set(
        row.userId,
        (completedCountByUser.get(row.userId) ?? 0) + 1
      );
    }

    const completedUserIds = Array.from(completedCountByUser.entries())
      .filter(([, count]) => count >= ADMIN_CHECKLIST_STEP_TOTAL)
      .map(([userId]) => userId);
    const baseWhere = participantOverviewTableWhere("all", tableSearch);

    tableWhere =
      tableFilter === "checklist-complete"
        ? { AND: [baseWhere, { id: { in: completedUserIds } }] }
        : { AND: [baseWhere, { id: { notIn: completedUserIds } }] };
  }

  const enrolledWhere = { role: "PARTICIPANT" as const, isActive: true };

  const [
    enrolledParticipants,
    engagedInPeriod,
    enrolledWithChecklist,
    surveysCompleted,
  ] = await Promise.all([
    prisma.user.count({ where: enrolledWhere }),
    prisma.user.count({
      where: {
        ...enrolledWhere,
        OR: [
          { symptoms: { some: { date: { gte: from, lte: to } } } },
          {
            // App-marked-complete SURVEY checklist step in range (not REDCap-verified).
            checklist: {
              some: {
                templateId: { in: surveyChecklistTemplateIds },
                status: "COMPLETED",
                completedAt: { gte: from, lte: to },
              },
            },
          },
          { appointments: { some: { startAt: { gte: from, lte: to } } } },
        ],
      },
    }),
    prisma.user.findMany({
      where: enrolledWhere,
      select: {
        checklist: {
          where: checklistScope,
          select: {
            status: true,
            template: { select: { key: true } },
          },
        },
      },
    }),
    // Count unit: SURVEY checklist steps marked complete in the app, in range. Keeps the
    // pre-existing scope (no participant/role/active filter) rather than introducing a new one.
    prisma.participantChecklistItem.count({
      where: {
        templateId: { in: surveyChecklistTemplateIds },
        status: "COMPLETED",
        completedAt: { gte: from, lte: to },
      },
    }),
  ]);

  const checklistRatePct = computeCohortChecklistCompletionPct(
    enrolledWithChecklist.map((u) =>
      u.checklist.map((item) => ({
        templateKey: item.template.key,
        status: item.status,
      }))
    )
  );
  const enrolledPctOfCohort =
    COHORT_TARGET > 0
      ? Math.min(100, Math.round((enrolledParticipants / COHORT_TARGET) * 100))
      : 0;

  const denomTrend = Math.max(
    1,
    enrolledParticipants * ADMIN_CHECKLIST_STEP_TOTAL
  );
  const trend: { label: string; pct: number }[] = [];
  const trendCursor = new Date(from);
  while (trendCursor <= to && trend.length < 14) {
    const weekEnd = new Date(trendCursor);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const completedWeek = await prisma.participantChecklistItem.count({
      where: {
        status: "COMPLETED",
        completedAt: { gte: trendCursor, lt: weekEnd },
      },
    });
    trend.push({
      label: `${trendCursor.getMonth() + 1}/${trendCursor.getDate()}`,
      pct: Math.min(100, Math.round((completedWeek / denomTrend) * 100)),
    });
    trendCursor.setDate(trendCursor.getDate() + 7);
  }
  if (trend.length === 0) {
    trend.push({ label: "—", pct: checklistRatePct });
  }

  const [symptomDates, surveyDates] = await Promise.all([
    prisma.symptomEntry.findMany({
      where: { date: { gte: from, lte: to } },
      select: { date: true },
    }),
    // Same count unit as surveysCompleted above: app-marked-complete SURVEY checklist steps.
    prisma.participantChecklistItem.findMany({
      where: {
        templateId: { in: surveyChecklistTemplateIds },
        status: "COMPLETED",
        completedAt: { gte: from, lte: to },
      },
      select: { completedAt: true },
    }),
  ]);

  const span = Math.max(1, to.getTime() - from.getTime());
  const bucketCount =
    rangeKey === "7d" ? 7 : rangeKey === "30d" ? 10 : rangeKey === "3m" ? 12 : rangeKey === "6m" ? 12 : 14;
  const heatmapMode: "daily" | "weekly" | "monthly" =
    rangeKey === "7d" || rangeKey === "30d" ? "daily" : rangeKey === "all" ? "monthly" : "weekly";
  const columns = rangeKey === "7d" ? 7 : rangeKey === "30d" ? 5 : 7;

  const activityTs: number[] = [
    ...symptomDates.map((s) => s.date.getTime()),
    // completedAt is nullable on the field, but the query above range-filters it, which
    // excludes null at the database level — this filter narrows the type for TS, not behavior.
    ...surveyDates
      .map((s) => s.completedAt)
      .filter((d): d is Date => d instanceof Date)
      .map((d) => d.getTime()),
  ];

  const cells: AdminOverviewDashboardData["heatmap"]["cells"] = [];
  for (let i = 0; i < bucketCount; i++) {
    const a = from.getTime() + (i * span) / bucketCount;
    const b = from.getTime() + ((i + 1) * span) / bucketCount;
    let count = 0;
    for (const t of activityTs) {
      if (t >= a && t < b) count += 1;
    }
    const mid = new Date((a + b) / 2);
    cells.push({
      key: `b-${i}`,
      label: `${mid.getMonth() + 1}/${mid.getDate()}`,
      count,
      intensity: 0,
    });
  }
  const maxC = Math.max(1, ...cells.map((c) => c.count));
  for (const c of cells) {
    c.intensity = c.count / maxC;
  }

  const filteredTotal = await prisma.user.count({ where: tableWhere });
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * pageSize;

  const users = await prisma.user.findMany({
    where: tableWhere,
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
    select: {
      id: true,
      name: true,
      isActive: true,
      profile: { select: { studyRecordId: true } },
      checklist: {
        where: checklistScope,
        select: {
          status: true,
          template: { select: { key: true } },
        },
      },
    },
  });

  const rows: AdminOverviewDashboardData["table"]["rows"] = [];
  for (const u of users) {
    const lastActive = await lastActiveTimestamp(u.id);
    const progress = computeAdminChecklistProgress(
      u.checklist.map((item) => ({
        templateKey: item.template.key,
        status: item.status,
      }))
    );

    rows.push({
      userId: u.id,
      recordId: displayStudyRecordId(u.profile, u.id),
      name: u.name?.trim() || "Participant",
      checklistCompleted: progress.completed,
      checklistTotal: progress.total,
      currentStep: progress.currentStepName,
      lastActive: lastActive ? lastActive.toISOString() : null,
    });
  }

  return {
    rangeKey,
    rangeLabel: rangeLabel(rangeKey),
    chartRangeLabel: chartRangeShort(rangeKey),
    kpi: {
      enrolledParticipants,
      engagedInPeriod,
      cohortTarget: COHORT_TARGET,
      enrolledPctOfCohort,
      checklistRatePct,
      surveysCompleted,
    },
    trend,
    heatmap: { mode: heatmapMode, cells, columns },
    table: {
      rows,
      page: safePage,
      totalPages,
      total: filteredTotal,
      filter: tableFilter,
      search: tableSearch,
    },
  };
}
