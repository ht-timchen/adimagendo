"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ParticipantActions,
  type ParticipantActionPermissions,
} from "@/components/admin/participant-row-actions";
import {
  sortParticipantProgressRows,
  type ParticipantProgressKpis,
  type ParticipantProgressRow,
  type ParticipantProgressStatus,
} from "@/lib/admin/participant-progress";

type Props = {
  kpis: ParticipantProgressKpis;
  rows: ParticipantProgressRow[];
  permissions: Pick<ParticipantActionPermissions, "canSendNotification">;
};

function statusBadge(status: ParticipantProgressStatus): { label: string; className: string } {
  switch (status) {
    case "withdrawn":
      return { label: "Withdrawn", className: "bg-slate-200 text-slate-700" };
    case "completed":
      return { label: "Completed", className: "bg-violet-100 text-violet-800" };
    case "overdue":
      return { label: "Overdue", className: "bg-rose-100 text-rose-800" };
    case "on_track":
      return { label: "On track", className: "bg-emerald-100 text-emerald-800" };
    default:
      return { label: status, className: "bg-slate-100 text-slate-700" };
  }
}

function progressBarColor(status: ParticipantProgressStatus): string {
  switch (status) {
    case "completed":
      return "bg-violet-600";
    case "overdue":
      return "bg-rose-600";
    default:
      return "bg-emerald-600";
  }
}

function dueDateClassName(tone: ParticipantProgressRow["dueDateTone"]): string {
  switch (tone) {
    case "overdue":
      return "text-rose-600";
    case "today":
    case "this_week":
      return "text-amber-600";
    default:
      return "text-slate-700";
  }
}

export function ParticipantProgressDashboard({ kpis, rows, permissions }: Props) {
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? rows.filter((row) => {
          const haystack = [
            row.name,
            row.email,
            row.studyRecordId,
            row.detailRecordId,
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        })
      : rows;
    return sortParticipantProgressRows(matched);
  }, [query, rows]);

  return (
    <div className="mx-auto max-w-[90rem] space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Participant Progress
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Detailed progress tracker across study phase, next task, verification,
          activity, and sync state.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60 dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Overall Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {kpis.overallCompletionPct}%
            </p>
            <p className="text-xs text-slate-500">
              {kpis.completedItems} of {kpis.totalItems} items completed
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60 dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {kpis.inProgressCount}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60 dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-rose-600">{kpis.overdueCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60 dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Participants</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {kpis.participantCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, ID, or email..."
          className="rounded-xl pl-9"
          aria-label="Search participants"
        />
      </div>

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60 dark:bg-slate-900">
        <CardContent className="overflow-x-auto px-0 pb-0 pt-0">
          {filteredRows.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">
              {rows.length === 0 ? "No participants yet." : "No participants match your search."}
            </p>
          ) : (
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                  <th className="px-4 py-3">Participant</th>
                  <th className="px-4 py-3">Current Phase</th>
                  <th className="px-4 py-3">Next Task</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Completion</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const badge = statusBadge(row.status);
                  const pct =
                    row.total > 0 ? Math.min(100, Math.round((row.completed / row.total) * 100)) : 0;

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{row.name}</p>
                        <p className="text-xs text-slate-500">{row.studyRecordId}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                        {row.currentPhase}
                      </td>
                      <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                        {row.nextTask ?? "Complete"}
                      </td>
                      <td className="px-4 py-3">
                        <div className={cn("font-medium", dueDateClassName(row.dueDateTone))}>
                          {row.dueDateLabel}
                        </div>
                        {row.daysLate != null ? (
                          <p className="text-xs text-rose-600">{row.daysLate} days late</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-[120px] items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className={cn("h-full rounded-full", progressBarColor(row.status))}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-xs tabular-nums text-slate-600 dark:text-slate-400">
                            {row.completed} / {row.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ParticipantActions
                          target={{
                            id: row.id,
                            name: row.name,
                            email: row.email,
                            studyRecordId: row.detailRecordId,
                            isActive: row.isActive,
                          }}
                          permissions={{
                            canResetPassword: false,
                            canSendNotification: permissions.canSendNotification,
                            canManageEnrolment: false,
                            canUpdateParticipant: false,
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
