"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_CHECKLIST_ALL_COMPLETE_LABEL } from "@/lib/admin/checklist-progress";
import { LEVEL_1_FOLLOW_UP_LABEL } from "@/lib/checklist/level1-follow-up";
import { participantStatusDisplay, type ParticipantStudyStatus } from "@/lib/admin-display";
import { ParticipantStatusLegend } from "@/components/admin/participant-status-legend";
import type { ParticipantClassificationFilter } from "@/lib/participant/pilot-participant-scope";
import {
  ParticipantActions,
  type ParticipantActionPermissions,
} from "@/components/admin/participant-row-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type ParticipantRow = {
  id: string;
  name: string | null;
  email: string;
  recordId: string;
  studyRecordId: string | null;
  isActive: boolean;
  enrollmentDate: string | null;
  dateOfBirth: string | null;
  checklistCompleted: number;
  checklistTotal: number;
  currentStep: string | null;
  status: ParticipantStudyStatus;
  level1FollowUpDue: boolean;
  classificationLabel: string;
  classificationClassName: string;
};

export function AdminParticipantsTable({
  participants,
  permissions,
  classificationFilter,
  recordIdQuery = "",
}: {
  participants: ParticipantRow[];
  permissions: ParticipantActionPermissions;
  classificationFilter: ParticipantClassificationFilter;
  recordIdQuery?: string;
}) {
  const compactColumns = classificationFilter === "all";
  const columnCount = compactColumns ? 7 : 11;

  return (
    <div className="space-y-4">
      <form
        method="get"
        action="/dashboard/admin/participants"
        className="flex max-w-md flex-wrap items-center gap-2"
      >
        {classificationFilter !== "all" ? (
          <input type="hidden" name="classification" value={classificationFilter} />
        ) : null}
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            name="q"
            defaultValue={recordIdQuery}
            placeholder="Search by record ID"
            className="rounded-xl pl-9"
            aria-label="Search by record ID"
          />
        </div>
        <Button type="submit" variant="outline" className="rounded-xl">
          Search
        </Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-md shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950/40">
        <table
          className={cn(
            "w-full text-left text-sm",
            compactColumns ? "min-w-[900px]" : "min-w-[1380px]"
          )}
        >
          <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/40">
            <tr>
              <th className="px-4 py-3">Record ID</th>
              <th className="px-4 py-3">Classification</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">
                <ParticipantStatusLegend />
              </th>
              <th className="px-4 py-3">Enrollment date</th>
              {!compactColumns ? (
                <>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Level 1 follow-up</th>
                  <th className="px-4 py-3">Current Step</th>
                  <th className="px-4 py-3">Date of birth</th>
                </>
              ) : null}
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
            {participants.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-10 text-center text-slate-500">
                  {recordIdQuery
                    ? "No participants match that record ID."
                    : "No participants found."}
                </td>
              </tr>
            ) : (
              participants.map((p) => {
                const sd = participantStatusDisplay(p.status);
                const detailHref =
                  p.studyRecordId != null
                    ? `/dashboard/admin/participants/${encodeURIComponent(p.studyRecordId)}`
                    : null;

                return (
                  <tr
                    key={p.id}
                    className={cn(
                      "hover:bg-slate-50/60 dark:hover:bg-slate-900/30",
                      p.status === "withdrawn" && "bg-slate-50/80 opacity-75"
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                      {detailHref ? (
                        <Link
                          href={detailHref}
                          className="text-brand hover:text-brand-hover hover:underline"
                        >
                          {p.recordId}
                        </Link>
                      ) : (
                        p.recordId
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                          p.classificationClassName
                        )}
                      >
                        {p.classificationLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {p.name?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", sd.dot)} />
                        <span className="text-slate-700 dark:text-slate-300">{sd.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {p.enrollmentDate ?? "—"}
                    </td>
                    {!compactColumns ? (
                      <>
                        <td className="px-4 py-3 tabular-nums text-slate-800 dark:text-slate-200">
                          {p.checklistCompleted} / {p.checklistTotal}
                        </td>
                        <td className="max-w-[200px] px-4 py-3">
                          {p.level1FollowUpDue ? (
                            <span
                              className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
                              title={LEVEL_1_FOLLOW_UP_LABEL}
                            >
                              Follow-up due
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="max-w-[220px] px-4 py-3 text-slate-700 dark:text-slate-300">
                          <span className="line-clamp-2">
                            {p.currentStep === null && p.checklistCompleted >= p.checklistTotal
                              ? ADMIN_CHECKLIST_ALL_COMPLETE_LABEL
                              : (p.currentStep ?? "—")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {p.dateOfBirth ?? "—"}
                        </td>
                      </>
                    ) : null}
                    <td className="px-4 py-3 text-right">
                      {p.studyRecordId ? (
                        <ParticipantActions
                          target={{
                            id: p.id,
                            name: p.name,
                            email: p.email,
                            studyRecordId: p.studyRecordId,
                            isActive: p.isActive,
                          }}
                          permissions={permissions}
                          variant="row"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
