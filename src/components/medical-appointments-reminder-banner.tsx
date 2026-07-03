"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MedicalAppointmentsBannerState } from "@/lib/medical-appointments-reminder/types";

type Props = MedicalAppointmentsBannerState;

export function MedicalAppointmentsReminderBanner({ cycleId }: Props) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hidden) return null;

  async function dismiss() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/medical-appointments-reminder", {
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
      const res = await fetch("/api/medical-appointments-reminder", {
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
      className="rounded-lg border border-[#2F8F7A]/30 bg-white/85 p-4 text-sm text-[#2A6F60] shadow-sm backdrop-blur-sm"
      role="dialog"
      aria-labelledby="medical-appointments-reminder-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <p
            id="medical-appointments-reminder-title"
            className="font-semibold text-[#17483F]"
          >
            Medical Appointments Diary
          </p>
          <p className="text-[#2A6F60]">
            Did you see a health professional at any time this month?
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
              className="border-[#2F8F7A]/40 text-[#1E5D50] hover:bg-[#e8f3f0]"
              disabled={busy}
              onClick={() => respond("no")}
            >
              No
            </Button>
          </div>
          {error ? (
            <p className="text-xs text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0 text-[#2F8F7A] hover:bg-[#e8f3f0]"
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
