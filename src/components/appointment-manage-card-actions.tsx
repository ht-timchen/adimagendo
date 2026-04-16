"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  combineLocalDateTime,
  formatAppointmentDateTime,
  todayYmdLocal,
  toDateAndTimeInputs,
} from "@/lib/local-datetime";

export type SerializableAppointment = {
  id: string;
  title: string;
  status: "CONFIRMED" | "PENDING" | "CANCELLED";
  startAt: string;
  scheduledStartAt: string | null;
  scheduledLocation: string | null;
  location: string | null;
  description: string | null;
  externalUrl: string | null;
  participantChecklistItemId: string | null;
};

type Props = {
  appointment: SerializableAppointment;
};

export function AppointmentManageCardActions({ appointment: initial }: Props) {
  const router = useRouter();
  const [appt, setAppt] = useState(initial);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const cancelDialogRef = useRef<HTMLDialogElement>(null);
  const [editStep, setEditStep] = useState<"form" | "preview">("form");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setAppt(initial);
  }, [initial]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const displayStart = new Date(
    appt.scheduledStartAt ?? appt.startAt
  );

  const openEdit = () => {
    const { date, time } = toDateAndTimeInputs(displayStart);
    setDateStr(date);
    setTimeStr(time);
    setLocation(
      appt.scheduledLocation ?? appt.location ?? ""
    );
    setEditStep("form");
    editDialogRef.current?.showModal();
  };

  const closeEdit = () => {
    editDialogRef.current?.close();
    setEditStep("form");
  };

  const previewCombined = combineLocalDateTime(dateStr, timeStr);

  const goPreview = () => {
    const combined = combineLocalDateTime(dateStr, timeStr);
    if (!combined) return;
    if (combined.getTime() <= Date.now()) {
      showToast("Please choose a future date and time.");
      return;
    }
    setEditStep("preview");
  };

  const saveEdit = async () => {
    const combined = combineLocalDateTime(dateStr, timeStr);
    if (!combined) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/participant/appointments/${appt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledStartAt: combined.toISOString(),
          scheduledLocation: location.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        appointment?: {
          startAt: string;
          scheduledStartAt: string | null;
          scheduledLocation: string | null;
          location: string | null;
        };
      };
      if (!res.ok) {
        showToast(
          typeof data.error === "string" ? data.error : "Could not update."
        );
        return;
      }
      if (data.appointment) {
        setAppt((prev) => ({
          ...prev,
          startAt: data.appointment!.startAt,
          scheduledStartAt: data.appointment!.scheduledStartAt,
          scheduledLocation: data.appointment!.scheduledLocation,
          location: data.appointment!.location,
        }));
      }
      closeEdit();
      showToast("Appointment updated.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/participant/appointments/${appt.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        showToast(
          typeof data.error === "string" ? data.error : "Could not cancel."
        );
        return;
      }
      cancelDialogRef.current?.close();
      setAppt((prev) => ({ ...prev, status: "CANCELLED" }));
      showToast("Appointment cancelled.");
      router.refresh();
    } finally {
      setCancelling(false);
    }
  };

  if (appt.status === "CANCELLED") {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
      <Button type="button" size="sm" variant="outline" onClick={openEdit}>
        Edit appointment
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
        onClick={() => cancelDialogRef.current?.showModal()}
      >
        Cancel appointment
      </Button>

      <dialog
        ref={editDialogRef}
        className="fixed left-1/2 top-1/2 z-50 w-[min(100vw-2rem,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClose={() => setEditStep("form")}
      >
        {editStep === "form" ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Edit appointment
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Update the date and time for &quot;{appt.title}&quot;. Only future
              times are allowed.
            </p>
            <div className="grid gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Date
                </label>
                <Input
                  type="date"
                  min={todayYmdLocal()}
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Time
                </label>
                <Input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Location (optional)
                </label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Suite 3, Imaging Centre"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeEdit}>
                Close
              </Button>
              <Button type="button" onClick={goPreview}>
                Continue
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Review changes
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Your appointment will be:{" "}
              <span className="font-medium">
                {previewCombined
                  ? formatAppointmentDateTime(previewCombined)
                  : "—"}
              </span>
              . Save these changes?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditStep("form")}
                disabled={saving}
              >
                Back
              </Button>
              <Button type="button" onClick={saveEdit} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </dialog>

      <dialog
        ref={cancelDialogRef}
        className="fixed left-1/2 top-1/2 z-50 w-[min(100vw-2rem,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Cancel this visit?
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {appt.participantChecklistItemId
              ? "This removes the visit from your schedule. You can confirm a new date and time from your checklist if you still need the appointment."
              : "This removes the visit from your schedule."}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => cancelDialogRef.current?.close()}
              disabled={cancelling}
            >
              Keep appointment
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-rose-300 text-rose-800 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-950/50"
              onClick={confirmCancel}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling…" : "Yes, cancel"}
            </Button>
          </div>
        </div>
      </dialog>

      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-[60] max-w-sm rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
