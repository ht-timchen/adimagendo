"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useActionState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bell,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileDown,
  FileText,
  FileUp,
  Filter,
  Newspaper,
  Send,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  OVERVIEW_TABLE_FILTER_OPTIONS,
  overviewTableFilterLabel,
  type OverviewTableFilter,
} from "@/lib/admin-overview-table-filter";
import { ADMIN_CHECKLIST_ALL_COMPLETE_LABEL } from "@/lib/admin/checklist-progress";

export type RangeKey = "7d" | "30d" | "3m" | "6m" | "12m" | "all";

export type AdminOverviewDashboardData = {
  rangeKey: RangeKey;
  rangeLabel: string;
  chartRangeLabel: string;
  kpi: {
    enrolledParticipants: number;
    engagedInPeriod: number;
    cohortTarget: number;
    enrolledPctOfCohort: number;
    checklistRatePct: number;
    surveysCompleted: number;
  };
  trend: { label: string; pct: number }[];
  heatmap: {
    mode: "daily" | "weekly" | "monthly";
    cells: { key: string; label: string; count: number; intensity: number }[];
    columns: number;
  };
  table: {
    rows: {
      userId: string;
      recordId: string;
      name: string;
      checklistCompleted: number;
      checklistTotal: number;
      currentStep: string | null;
      lastActive: string | null;
    }[];
    page: number;
    totalPages: number;
    total: number;
    filter: OverviewTableFilter;
    search: string;
  };
};

const FILTER_MENU_WIDTH = 280;
const FILTER_MENU_GAP = 6;

function OverviewParticipantsFilter({
  filter,
  search,
  isActive,
  onApply,
  onClear,
}: {
  filter: OverviewTableFilter;
  search: string;
  isActive: boolean;
  onApply: (filter: OverviewTableFilter, search: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draftFilter, setDraftFilter] = useState<OverviewTableFilter>(filter);
  const [draftSearch, setDraftSearch] = useState(search);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setDraftFilter(filter);
    setDraftSearch(search);
  }, [open, filter, search]);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight ?? 320;
    const viewportPad = 12;
    let top = rect.bottom + FILTER_MENU_GAP;
    if (top + menuHeight > window.innerHeight - viewportPad) {
      top = rect.top - FILTER_MENU_GAP - menuHeight;
    }
    top = Math.max(viewportPad, Math.min(top, window.innerHeight - menuHeight - viewportPad));
    let left = rect.right - FILTER_MENU_WIDTH;
    left = Math.max(viewportPad, Math.min(left, window.innerWidth - FILTER_MENU_WIDTH - viewportPad));
    setMenuPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    function onScrollOrResize() {
      updateMenuPosition();
    }
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const selectClass =
    "flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-violet-500 focus:ring-2";

  const menu = (
    <div
      ref={menuRef}
      role="dialog"
      aria-label="Filter participants"
      style={
        menuPos
          ? {
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: FILTER_MENU_WIDTH,
              zIndex: 9999,
            }
          : { position: "fixed", visibility: "hidden", width: FILTER_MENU_WIDTH, zIndex: 9999 }
      }
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-300/40 ring-1 ring-slate-900/5"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filter table</p>
      <div className="mt-3 space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Show</label>
          <select
            className={selectClass}
            value={draftFilter}
            onChange={(e) => setDraftFilter(e.target.value as OverviewTableFilter)}
          >
            {OVERVIEW_TABLE_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Search name or record ID</label>
          <Input
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            placeholder="e.g. STUDY-ABC123"
            className="rounded-xl"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onApply(draftFilter, draftSearch);
                setOpen(false);
              }
            }}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-xl"
          onClick={() => {
            onClear();
            setOpen(false);
          }}
        >
          Clear
        </Button>
        <Button
          type="button"
          size="sm"
          className="rounded-xl bg-violet-600 hover:bg-violet-700"
          onClick={() => {
            onApply(draftFilter, draftSearch);
            setOpen(false);
          }}
        >
          Apply
        </Button>
      </div>
    </div>
  );

  return (
    <div ref={triggerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "rounded-xl border-slate-200",
          isActive && "border-violet-300 bg-violet-50 text-violet-900"
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Filter className="mr-1 h-4 w-4" />
        Filter
        {isActive ? (
          <span className="ml-1.5 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            On
          </span>
        ) : null}
      </Button>
      {mounted && open ? createPortal(menu, document.body) : null}
    </div>
  );
}

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function PushModal({
  userId,
  participantLabel,
  onClose,
  action,
}: {
  userId: string;
  participantLabel: string;
  onClose: () => void;
  action: (
    prev: { ok: boolean; error?: string } | null,
    formData: FormData
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      ref.current?.close();
      onClose();
    }
  }, [state, onClose, router]);

  return (
    <dialog
      ref={ref}
      className="fixed inset-0 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40"
      onClose={onClose}
    >
      <form action={formAction} className="flex flex-col gap-4 p-6">
        <input type="hidden" name="userId" value={userId} />
        <div>
          <h2 className="text-lg font-semibold">Send notification</h2>
          <p className="mt-1 text-sm text-slate-600">To {participantLabel}</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Title</label>
          <input
            name="title"
            required
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-500 focus:ring-2"
            placeholder="Notification title"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Message (optional)</label>
          <textarea
            name="body"
            rows={3}
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-500 focus:ring-2"
            placeholder="Short message"
          />
        </div>
        {state?.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => ref.current?.close()}>
            Cancel
          </Button>
          <Button type="submit" className="rounded-xl bg-violet-600 hover:bg-violet-700">
            Send
          </Button>
        </div>
      </form>
    </dialog>
  );
}

export function ClinicalAdminOverviewDashboard({
  data,
  adminName,
  adminInitial,
  rangeOptions,
  sendParticipantPushAction,
}: {
  data: AdminOverviewDashboardData;
  adminName: string;
  adminInitial: string;
  rangeOptions: { key: RangeKey; label: string }[];
  sendParticipantPushAction: (
    prev: { ok: boolean; error?: string } | null,
    formData: FormData
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pushTarget, setPushTarget] = useState<{ userId: string; label: string } | null>(null);

  const currentRange = (searchParams.get("range") as RangeKey | null) || data.rangeKey;
  const tablePage = data.table.page;

  const setRange = (key: RangeKey) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("range", key);
    p.set("page", "1");
    router.push(`${pathname}?${p.toString()}`);
  };

  const setPage = (p: number) => {
    const q = new URLSearchParams(searchParams.toString());
    q.set("page", String(p));
    router.push(`${pathname}?${q.toString()}`);
  };

  const applyTableFilters = (filter: OverviewTableFilter, search: string) => {
    const q = new URLSearchParams(searchParams.toString());
    if (filter === "all") q.delete("filter");
    else q.set("filter", filter);
    if (search.trim()) q.set("q", search.trim());
    else q.delete("q");
    q.set("page", "1");
    router.push(`${pathname}?${q.toString()}`);
  };

  const clearTableFilters = () => {
    const q = new URLSearchParams(searchParams.toString());
    q.delete("filter");
    q.delete("q");
    q.set("page", "1");
    router.push(`${pathname}?${q.toString()}`);
  };

  const tableFilterActive =
    data.table.filter !== "all" || data.table.search.length > 0;

  const greet = greetingWord();

  const quickLinks = [
    { href: "/dashboard/admin/actions/import", label: "Import CSV", icon: FileUp },
    { href: "/dashboard/admin/actions/export", label: "Export CSV", icon: FileDown },
    { href: "/dashboard/admin/actions/notify", label: "Send notifications", icon: Send },
    { href: "/dashboard/admin/news", label: "News Post", icon: Newspaper },
  ];

  return (
    <div className="min-h-full bg-[#f7f8fc] pb-10">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-6 lg:flex-row lg:items-start lg:gap-8 lg:px-6">
        <div className="min-w-0 flex-1 space-y-8">
          {/* HEADER */}
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Good {greet}, {adminName} 👋
              </h1>
              <p className="mt-1 text-sm text-slate-600">Here&apos;s what&apos;s happening with your study today.</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <select
                  aria-label="Time range"
                  className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm font-medium text-slate-800 shadow-sm outline-none ring-violet-500 focus:ring-2"
                  value={currentRange}
                  onChange={(e) => setRange(e.target.value as RangeKey)}
                >
                  {rangeOptions.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronRight className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-slate-500" />
              </div>
              <Link
                href="/dashboard/admin/messages"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                aria-label="Messages"
              >
                <Bell className="h-5 w-5" />
              </Link>
              <Link
                href="/dashboard/admin/profile"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-violet-100 text-sm font-semibold text-violet-800 shadow-sm transition hover:bg-violet-200"
                aria-label="Profile"
              >
                {adminInitial}
              </Link>
              </div>
              <p className="text-xs text-slate-500">Range applies to engaged count, heatmap &amp; surveys</p>
            </div>
          </header>

          {/* KPI */}
          <section className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
              <CardContent className="p-5">
                <Users className="mb-3 h-5 w-5 text-violet-600" />
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Participants</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-xs text-slate-500">Enrolled</p>
                    <p className="text-3xl font-bold tabular-nums text-slate-900">
                      {data.kpi.enrolledParticipants}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">Active in the study (not withdrawn)</p>
                  </div>
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-500">Engaged ({data.rangeLabel})</p>
                    <p className="text-2xl font-bold tabular-nums text-violet-700">
                      {data.kpi.engagedInPeriod}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Logged symptoms, completed a survey, or had an appointment
                    </p>
                  </div>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  {data.kpi.enrolledPctOfCohort}% of {data.kpi.cohortTarget} cohort target (enrolled)
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
              <CardContent className="p-5">
                <ClipboardList className="mb-3 h-5 w-5 text-violet-600" />
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Checklist Completion Rate</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{data.kpi.checklistRatePct}%</p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>Average study steps (19 per participant)</span>
                  <span className="inline-flex items-center gap-0.5 font-semibold text-violet-600">
                    <TrendingUp className="h-3.5 w-3.5" /> Up
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
              <CardContent className="p-5">
                <FileText className="mb-3 h-5 w-5 text-violet-600" />
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Surveys Completed</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{data.kpi.surveysCompleted}</p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>Submitted QoL surveys</span>
                  <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600">
                    <TrendingUp className="h-3.5 w-3.5" /> Up
                  </span>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* CHARTS */}
          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">Checklist Completion Trend</CardTitle>
                  <CardDescription>Completion % over time</CardDescription>
                </div>
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800">
                  {data.chartRangeLabel}
                </span>
              </CardHeader>
              <CardContent className="h-72 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" unit="%" />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
                      formatter={(v) => [`${v ?? 0}%`, "Completion"]}
                    />
                    <Line type="monotone" dataKey="pct" stroke="#7c3aed" strokeWidth={2} dot={false} name="Completion %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">Participant Activity Heatmap</CardTitle>
                  <CardDescription className="capitalize">{data.heatmap.mode} view</CardDescription>
                </div>
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800">
                  {data.chartRangeLabel}
                </span>
              </CardHeader>
              <CardContent className="pt-2">
                <div
                  className="grid gap-1.5"
                  style={{
                    gridTemplateColumns: `repeat(${data.heatmap.columns}, minmax(0, 1fr))`,
                  }}
                >
                  {data.heatmap.cells.map((cell) => (
                    <div
                      key={cell.key}
                      title={`${cell.label}: ${cell.count} activities`}
                      className="flex aspect-square max-h-10 flex-col items-center justify-center rounded-lg text-[10px] font-medium text-slate-700"
                      style={{
                        backgroundColor: `rgba(124, 58, 237, ${0.12 + cell.intensity * 0.78})`,
                      }}
                    >
                      <span className="truncate px-0.5">{data.heatmap.mode === "weekly" ? cell.count : cell.label}</span>
                      {data.heatmap.mode !== "weekly" ? (
                        <span className="text-[9px] text-slate-600">{cell.count}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* TABLE */}
          <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900">Recent Participants Overview</CardTitle>
                <CardDescription>Monitor checklist progress and engagement</CardDescription>
              </div>
              <OverviewParticipantsFilter
                filter={data.table.filter}
                search={data.table.search}
                isActive={tableFilterActive}
                onApply={applyTableFilters}
                onClear={clearTableFilters}
              />
            </CardHeader>
            {tableFilterActive ? (
              <div className="border-b border-slate-100 px-6 pb-3 text-xs text-slate-600">
                Showing {data.table.total} participant{data.table.total === 1 ? "" : "s"}
                {data.table.filter !== "all" ? (
                  <span>
                    {" "}
                    · Filter: <span className="font-medium">{overviewTableFilterLabel(data.table.filter)}</span>
                  </span>
                ) : null}
                {data.table.search ? (
                  <span>
                    {" "}
                    · Search: <span className="font-medium">&quot;{data.table.search}&quot;</span>
                  </span>
                ) : null}
              </div>
            ) : null}
            <CardContent className="overflow-x-auto px-0 pb-0">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Record ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3">Current Step</th>
                    <th className="px-4 py-3">Last Active</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.table.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        No participants match this filter.
                      </td>
                    </tr>
                  ) : null}
                  {data.table.rows.map((row) => (
                      <tr key={row.userId} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{row.recordId}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                        <td className="px-4 py-3 tabular-nums text-slate-800">
                          {row.checklistCompleted} / {row.checklistTotal}
                        </td>
                        <td
                          className="max-w-[200px] truncate px-4 py-3 text-slate-700"
                          title={
                            row.currentStep === null &&
                            row.checklistCompleted >= row.checklistTotal
                              ? ADMIN_CHECKLIST_ALL_COMPLETE_LABEL
                              : (row.currentStep ?? "—")
                          }
                        >
                          {row.currentStep === null &&
                          row.checklistCompleted >= row.checklistTotal
                            ? ADMIN_CHECKLIST_ALL_COMPLETE_LABEL
                            : (row.currentStep ?? "—")}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.lastActive
                            ? new Date(row.lastActive).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-violet-200 text-violet-800 hover:bg-violet-50"
                            onClick={() => setPushTarget({ userId: row.userId, label: row.name })}
                          >
                            Send Notification
                          </Button>
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={tablePage <= 1}
                  onClick={() => setPage(tablePage - 1)}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Prev
                </Button>
                <span>
                  Page {data.table.page} of {data.table.totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={tablePage >= data.table.totalPages}
                  onClick={() => setPage(tablePage + 1)}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* QUICK ACTIONS */}
        <aside className="w-full shrink-0 space-y-3 lg:w-72">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick actions</p>
          <div className="flex flex-col gap-2">
            {quickLinks.map((q) => {
              const Icon = q.icon;
              return (
                <Link
                  key={q.href}
                  href={q.href}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/50"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-violet-600" />
                    {q.label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-violet-600" />
                </Link>
              );
            })}
          </div>
          <Card className="rounded-xl border border-violet-100 bg-violet-50/80 shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-violet-950">Need help?</p>
              <p className="mt-1 text-xs leading-relaxed text-violet-900/80">View user guide or contact support.</p>
              <Button type="button" variant="outline" size="sm" className="mt-3 w-full rounded-xl border-violet-200 bg-white text-violet-900 hover:bg-violet-100">
                <BookOpen className="mr-2 h-4 w-4" />
                Open guide
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      {pushTarget ? (
        <PushModal
          userId={pushTarget.userId}
          participantLabel={pushTarget.label}
          action={sendParticipantPushAction}
          onClose={() => setPushTarget(null)}
        />
      ) : null}
    </div>
  );
}
