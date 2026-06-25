"use client";

import Link from "next/link";
import { AlertTriangle, HelpCircle, Mail, MessageSquare, Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JoinStatus, StudyStatus } from "@/lib/admin/participant-detail-status";
import {
  joinStatusDisplay,
  studyStatusDisplay,
  redcapTypeBadge,
} from "@/lib/admin/participant-detail-status";
import {
  ParticipantActions,
  type ParticipantActionPermissions,
  type ParticipantActionTarget,
} from "@/components/admin/participant-row-actions";

export type ParticipantDetailData = {
  userId: string;
  studyRecordId: string;
  name: string | null;
  registeredEmail: string;
  redcapEmail: string | null;
  dateOfBirth: string;
  redcapType: string | null;
  emailMismatch: boolean;
  joinStatus: JoinStatus;
  accessDisabledReason: string | null;
  studyStatus: StudyStatus;
  checklistCompleted: number;
  checklistTotal: number;
  checklistOverdue: number;
  lastActivity: string;
  enrolledDate: string;
  permissions: ParticipantActionPermissions;
};

const JOIN_STATUS_LEGEND = [
  { label: "Joined", text: "Participant has a bound app account." },
  { label: "Invited", text: "Active enrolment link sent, not yet used." },
  { label: "Expired", text: "Enrolment link expired before activation." },
  { label: "Not invited", text: "No enrolment link has been generated." },
  { label: "Access disabled", text: "Admin has disabled app access." },
] as const;

function JoinStatusLegend() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative inline-flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full text-slate-400 hover:bg-brand-surface hover:text-brand"
        aria-expanded={open}
        aria-label="Join status definitions"
        onClick={() => setOpen((v) => !v)}
      >
        <HelpCircle className="h-4 w-4" />
      </Button>
      {open ? (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg"
          role="dialog"
          aria-label="Join status definitions"
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Join status
          </p>
          <ul className="space-y-2 text-xs text-slate-700">
            {JOIN_STATUS_LEGEND.map((row) => (
              <li key={row.label} className="leading-snug">
                <span className="font-semibold text-slate-900">{row.label}</span>
                <span className="text-slate-600"> — {row.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DetailTable({
  rows,
}: {
  rows: { label: React.ReactNode; value: React.ReactNode }[];
}) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} className="border-b border-slate-100 last:border-0">
            <th className="w-44 py-3 pr-4 text-left font-medium text-slate-500">{row.label}</th>
            <td className="py-3 text-slate-900">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ParticipantDetailClient({ data }: { data: ParticipantDetailData }) {
  const joinBadge = joinStatusDisplay(data.joinStatus);
  const studyBadge = studyStatusDisplay(data.studyStatus);
  const typeBadge = redcapTypeBadge(data.redcapType);

  const actionTarget: ParticipantActionTarget = {
    id: data.userId,
    name: data.name,
    email: data.registeredEmail,
    studyRecordId: data.studyRecordId,
    isActive: data.joinStatus !== "access_disabled",
  };

  const displayName = data.name?.trim() || "—";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/dashboard/admin/participants"
            className="inline-flex text-sm text-slate-600 hover:text-slate-900"
          >
            ← Back to Participants
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">
            <span className="font-mono">{data.studyRecordId}</span>
            <span className="mx-2 text-slate-400">·</span>
            {displayName}
          </h1>
        </div>
        <ParticipantActions
          target={actionTarget}
          permissions={data.permissions}
          variant="header"
          showViewDetails={false}
        />
      </div>

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Identity</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailTable
            rows={[
              { label: "DOB", value: data.dateOfBirth },
              { label: "Registered email", value: data.registeredEmail },
              {
                label: "REDCap email",
                value: (
                  <span className="inline-flex items-center gap-1.5">
                    {data.redcapEmail ?? "—"}
                    {data.emailMismatch ? (
                      <span title="Registered email differs from REDCap email">
                        <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
                        <span className="sr-only">Email mismatch</span>
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                label: "REDCap type",
                value: (
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                      typeBadge.className
                    )}
                  >
                    {typeBadge.label}
                  </span>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Status</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailTable
            rows={[
              {
                label: (
                  <span className="inline-flex items-center gap-1">
                    Join Status
                    <JoinStatusLegend />
                  </span>
                ),
                value: (
                  <div>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        joinBadge.className
                      )}
                    >
                      {joinBadge.label}
                    </span>
                    {data.joinStatus === "access_disabled" && data.accessDisabledReason ? (
                      <p className="mt-1 text-xs text-slate-500">{data.accessDisabledReason}</p>
                    ) : null}
                  </div>
                ),
              },
              {
                label: "Study Status",
                value: (
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                      studyBadge.className
                    )}
                  >
                    {studyBadge.label}
                  </span>
                ),
              },
              {
                label: "Progress",
                value: (
                  <span className="tabular-nums">
                    {data.checklistCompleted} / {data.checklistTotal}
                    {data.checklistOverdue > 0 ? (
                      <>
                        <span className="text-slate-400"> · </span>
                        <span className="font-medium text-orange-600">
                          {data.checklistOverdue} overdue
                        </span>
                      </>
                    ) : null}
                  </span>
                ),
              },
              { label: "Last activity", value: data.lastActivity },
              { label: "Enrolled date", value: data.enrolledDate },
            ]}
          />
        </CardContent>
      </Card>

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-brand" />
            Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
            <Mail className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">Message history will appear here.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-brand" />
            Notifications Sent
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
            <Bell className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">Notification history will appear here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
