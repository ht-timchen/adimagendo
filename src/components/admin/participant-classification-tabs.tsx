"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  PARTICIPANT_CLASSIFICATION_FILTER_OPTIONS,
  type ParticipantClassificationFilter,
} from "@/lib/participant/pilot-participant-scope";

type Props = {
  current: ParticipantClassificationFilter;
  counts: Record<ParticipantClassificationFilter, number>;
};

function tabHref(filter: ParticipantClassificationFilter): string {
  if (filter === "pilot") {
    return "/dashboard/admin/participants";
  }
  return `/dashboard/admin/participants?classification=${filter}`;
}

export function ParticipantClassificationTabs({ current, counts }: Props) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="Participant classification"
    >
      {PARTICIPANT_CLASSIFICATION_FILTER_OPTIONS.map((opt) => {
        const active = current === opt.value;
        return (
          <Link
            key={opt.value}
            href={tabHref(opt.value)}
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors",
              active
                ? "bg-violet-600 text-white ring-violet-600"
                : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
            )}
          >
            {opt.label}
            <span
              className={cn(
                "ml-2 rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                active
                  ? "bg-violet-500 text-white"
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
