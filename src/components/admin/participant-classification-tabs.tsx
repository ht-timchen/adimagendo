"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ParticipantClassificationFilter } from "@/lib/participant/pilot-participant-scope";

const TAB_ORDER: {
  value: ParticipantClassificationFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "test", label: "Test" },
  { value: "pilot", label: "Pilot" },
  { value: "unknown", label: "Unknown" },
];

type Props = {
  current: ParticipantClassificationFilter;
  counts: Record<ParticipantClassificationFilter, number>;
  recordIdQuery?: string;
};

function tabHref(filter: ParticipantClassificationFilter, recordIdQuery: string): string {
  const params = new URLSearchParams();
  if (filter !== "all") {
    params.set("classification", filter);
  }
  if (recordIdQuery) {
    params.set("q", recordIdQuery);
  }
  const query = params.toString();
  return query
    ? `/dashboard/admin/participants?${query}`
    : "/dashboard/admin/participants";
}

export function ParticipantClassificationTabs({
  current,
  counts,
  recordIdQuery = "",
}: Props) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="Participant classification"
    >
      {TAB_ORDER.map((opt) => {
        const active = current === opt.value;
        return (
          <Link
            key={opt.value}
            href={tabHref(opt.value, recordIdQuery)}
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors",
              active
                ? "bg-brand text-white ring-brand"
                : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
            )}
          >
            {opt.label}
            <span
              className={cn(
                "ml-2 rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                active
                  ? "bg-brand-active text-white"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              )}
            >
              {counts[opt.value]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
