"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SchoolAttendanceBannerState } from "@/lib/school-attendance-reminder/types";

type Props = SchoolAttendanceBannerState;

export function SchoolAttendanceReminderBanner({ cycleId }: Props) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hidden) return null;

  async function dismiss() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/school-attendance-reminder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId }),
      });
      if (!res.ok) {
        setError("Could not dismiss the reminder. Please try again.");
        return;
      }
      setHidden(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function respond(action: "yes" | "no") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/school-attendance-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, action }),
      });
      if (!res.ok) {
        setError("Could not save your response. Please try again.");
        return;
      }

      setHidden(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-lg border border-violet-300 bg-violet-50 p-4 text-sm text-violet-950 shadow-sm dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-50"
      role="dialog"
      aria-labelledby="school-attendance-reminder-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <p id="school-attendance-reminder-title" className="font-semibold">
            School Attendance Diary
          </p>
          <p className="text-violet-900/95 dark:text-violet-100/90">
            Did you miss school at any point this week? Let us know here!
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => respond("yes")}
            >
              Yes
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => respond("no")}
            >
              No
            </Button>
          </div>
          {error ? (
            <p className="text-xs text-rose-700 dark:text-rose-300" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0 text-violet-800 hover:bg-violet-100 dark:text-violet-200 dark:hover:bg-violet-900/50"
          disabled={busy}
          aria-label="Dismiss reminder"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
