import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  ClinicalAdminOverviewDashboard,
  type AdminOverviewDashboardData,
  type RangeKey,
} from "@/components/admin/clinical-admin-overview-dashboard";
import {
  displayStudyRecordId,
  lastActiveTimestamp,
  participantEngagementStatus,
} from "@/lib/admin-display";
import { sendParticipantPushAction } from "./_actions";

const COHORT_TARGET = Number(process.env.NEXT_PUBLIC_COHORT_TARGET ?? "400") || 400;

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
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

async function earliestActivityStart(): Promise<Date | null> {
  const [s, r, a] = await Promise.all([
    prisma.symptomEntry.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
    prisma.surveyResponse.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.appointment.findFirst({ orderBy: { startAt: "asc" }, select: { startAt: true } }),
  ]);
  const dates = [s?.date, r?.createdAt, a?.startAt].filter((d): d is Date => d instanceof Date);
  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}

async function loadDashboardData(
  sp: { range?: string; page?: string },
  now: Date
): Promise<AdminOverviewDashboardData> {
  const rangeKey = parseRangeKey(sp.range);
  let { from, to } = getRangeBounds(rangeKey, now);
  if (rangeKey === "all") {
    const minD = await earliestActivityStart();
    if (minD) from = minD;
  }

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 10;

  const [
    activeParticipants,
    checklistDone,
    checklistTotal,
    surveysCompleted,
    totalParticipants,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        role: "PARTICIPANT",
        active: true,
        OR: [
          { symptoms: { some: { date: { gte: from, lte: to } } } },
          {
            surveyResponses: {
              some: { updatedAt: { gte: from, lte: to }, completed: true },
            },
          },
          { appointments: { some: { startAt: { gte: from, lte: to } } } },
        ],
      },
    }),
    prisma.participantChecklistItem.count({ where: { status: "COMPLETED" } }),
    prisma.participantChecklistItem.count(),
    prisma.surveyResponse.count({
      where: { completed: true, updatedAt: { gte: from, lte: to } },
    }),
    prisma.user.count({ where: { role: "PARTICIPANT" } }),
  ]);

  const checklistRatePct =
    checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;
  const activePctOfCohort =
    COHORT_TARGET > 0 ? Math.min(100, Math.round((activeParticipants / COHORT_TARGET) * 100)) : 0;

  const denomTrend = Math.max(1, checklistTotal);
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
    prisma.surveyResponse.findMany({
      where: { completed: true, updatedAt: { gte: from, lte: to } },
      select: { updatedAt: true },
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
    ...surveyDates.map((s) => s.updatedAt.getTime()),
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

  const skip = (page - 1) * pageSize;
  const users = await prisma.user.findMany({
    where: { role: "PARTICIPANT" },
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
    select: {
      id: true,
      name: true,
      active: true,
      profile: { select: { studyRecordId: true } },
      checklist: {
        select: {
          status: true,
          template: { select: { title: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const rows: AdminOverviewDashboardData["table"]["rows"] = [];
  for (const u of users) {
    const lastActive = await lastActiveTimestamp(u.id);
    const totalC = u.checklist.length;
    const doneC = u.checklist.filter((c) => c.status === "COMPLETED").length;
    const checklistPct = totalC > 0 ? Math.round((doneC / totalC) * 100) : 0;
    const pending = u.checklist.find((c) => c.status !== "COMPLETED");
    const currentStep = pending?.template.title ?? "All steps complete";

    const status = participantEngagementStatus(u.active, lastActive, now);

    rows.push({
      userId: u.id,
      recordId: displayStudyRecordId(u.profile, u.id),
      name: u.name?.trim() || "Participant",
      status,
      checklistPct,
      currentStep,
      lastActive: lastActive ? lastActive.toISOString() : null,
    });
  }

  const totalPages = Math.max(1, Math.ceil(totalParticipants / pageSize));

  return {
    rangeKey,
    rangeLabel: rangeLabel(rangeKey),
    chartRangeLabel: chartRangeShort(rangeKey),
    kpi: {
      activeParticipants,
      cohortTarget: COHORT_TARGET,
      activePctOfCohort,
      checklistRatePct,
      surveysCompleted,
    },
    trend,
    heatmap: { mode: heatmapMode, cells, columns },
    table: {
      rows,
      page,
      totalPages,
      total: totalParticipants,
    },
  };
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const r = session.user.role;
  if (r !== "ADMIN" && r !== "SUPER_ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const data = await loadDashboardData(sp, new Date());
  const adminName = session.user.name?.trim() || session.user.email.split("@")[0] || "Admin";
  const adminInitial = adminName.slice(0, 1).toUpperCase();

  return (
    <ClinicalAdminOverviewDashboard
      data={data}
      adminName={adminName}
      adminInitial={adminInitial}
      rangeOptions={RANGE_OPTIONS}
      sendParticipantPushAction={sendParticipantPushAction}
    />
  );
}
