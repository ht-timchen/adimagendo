"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddToCalendarButton } from "@/components/add-to-calendar-button";
import { ExternalLink } from "lucide-react";
import {
  combineLocalDateTime,
  formatAppointmentDateTime,
  tomorrowYmdLocal,
} from "@/lib/local-datetime";

export type ChecklistBookingProgress = "NOT_STARTED" | "BOOKED_EXTERNALLY" | "CONFIRMED";

type AppointmentPayload = {
  id: string;
  title: string;
  description: string | null;
  scheduledStartAt: string | null;
  scheduledLocation: string | null;
  location: string | null;
  startAt: string;
  externalUrl: string | null;
};

type Props = {
  templateId: string;
  templateTitle: string;
  templateDescription: string | null;
  externalUrl: string;
  bookingProgress: ChecklistBookingProgress;
  bookedExternallyAt: string | null;
  appointment: AppointmentPayload | null;
};

function statusLabel(
  progress: ChecklistBookingProgress,
  appointment: AppointmentPayload | null
): { text: string; tone: "muted" | "warn" | "ok" } {
  if (progress === "CONFIRMED") {
    const raw =
      appointment?.scheduledStartAt ?? appointment?.startAt ?? null;
    if (raw) {
      const dt = new Date(raw);
      return {
        text: `Confirmed · ${formatAppointmentDateTime(dt)}`,
        tone: "ok",
      };
    }
    return { text: "Confirmed", tone: "ok" };
  }
  if (progress === "BOOKED_EXTERNALLY") {
    return { text: "Booked externally", tone: "warn" };
  }
  return { text: "Not started", tone: "muted" };
}

export function ChecklistExternalBookingFlow({
  templateId,
  templateTitle,
  templateDescription,
  externalUrl,
  bookingProgress: initialProgress,
  appointment: initialAppointment,
}: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [bookingProgress, setBookingProgress] =
    useState<ChecklistBookingProgress>(initialProgress);
  const [appointment, setAppointment] = useState<AppointmentPayload | null>(
    initialAppointment
  );
  const [finishingBooking, setFinishingBooking] = useState(false);
  const [step, setStep] = useState<"form" | "preview">("form");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setBookingProgress(initialProgress);
    setAppointment(initialAppointment);
  }, [initialProgress, initialAppointment]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const openModal = () => {
    setStep("form");
    setDateStr("");
    setTimeStr("");
    setLocation(
      appointment?.scheduledLocation ??
        appointment?.location ??
        initialAppointment?.scheduledLocation ??
        initialAppointment?.location ??
        ""
    );
    dialogRef.current?.showModal();
  };

  const closeModal = () => {
    dialogRef.current?.close();
    setStep("form");
  };

  const onFinishedBooking = async () => {
    setFinishingBooking(true);
    try {
      const res = await fetch("/api/checklist/book-externally", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) return;
      setBookingProgress("BOOKED_EXTERNALLY");
      router.refresh();
    } finally {
      setFinishingBooking(false);
    }
  };

  const goPreview = () => {
    const combined = combineLocalDateTime(dateStr, timeStr);
    if (!combined) return;
    if (combined.getTime() <= Date.now()) {
      showToast("Please choose a future date and time.");
      return;
    }
    setStep("preview");
  };

  const confirmAppointment = async () => {
    const combined = combineLocalDateTime(dateStr, timeStr);
    if (!combined) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/checklist/confirm-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          scheduledStartAt: combined.toISOString(),
          scheduledLocation: location.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        appointmentId?: string;
        scheduledStartAt?: string | null;
      };
      if (!res.ok) {
        showToast(
          typeof data.error === "string" ? data.error : "Could not save."
        );
        return;
      }
      setBookingProgress("CONFIRMED");
      if (data.appointmentId && data.scheduledStartAt) {
        const locTrim = location.trim() || null;
        setAppointment({
          id: data.appointmentId,
          title: templateTitle,
          description: templateDescription,
          scheduledStartAt: data.scheduledStartAt,
          scheduledLocation: locTrim,
          location: locTrim,
          startAt: data.scheduledStartAt,
          externalUrl,
        });
      }
      closeModal();
      showToast("Appointment confirmed! Reminders enabled.");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const badge = statusLabel(bookingProgress, appointment);
  const badgeClass =
    badge.tone === "ok"
      ? "bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-100 dark:ring-emerald-900"
      : badge.tone === "warn"
        ? "bg-amber-50 text-amber-950 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900"
        : "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700";

  const showExpandedPanel =
    bookingProgress === "BOOKED_EXTERNALLY" || bookingProgress === "CONFIRMED";
  const apptForIcs = appointment;
  const icsStart = apptForIcs?.scheduledStartAt
    ? new Date(apptForIcs.scheduledStartAt)
    : apptForIcs?.startAt
      ? new Date(apptForIcs.startAt)
      : null;

  const previewCombined = combineLocalDateTime(dateStr, timeStr);

  return (
    <div className="mt-3 w-full space-y-3">
      <div
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${badgeClass}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
        {badge.text}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center justify-center rounded-md bg-slate-100 px-3 text-sm font-medium hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          Book or open link <ExternalLink className="ml-1 h-4 w-4" />
        </a>
        {bookingProgress === "NOT_STARTED" ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={finishingBooking}
            onClick={onFinishedBooking}
          >
            {finishingBooking ? "Saving…" : "I've finished booking"}
          </Button>
        ) : null}
      </div>

      {showExpandedPanel ? (
        <div className="rounded-md border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          {bookingProgress === "BOOKED_EXTERNALLY" ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Confirm the date and time you chose with the clinic so your
                reminders stay accurate.
              </p>
              <Button type="button" size="sm" onClick={openModal}>
                Confirm appointment details
              </Button>
            </div>
          ) : bookingProgress === "CONFIRMED" && apptForIcs && icsStart ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Add this visit to your personal calendar.
              </p>
              <AddToCalendarButton
                input={{
                  appointmentId: apptForIcs.id,
                  startAt: icsStart,
                  endAt: null,
                  location:
                    apptForIcs.scheduledLocation ?? apptForIcs.location ?? null,
                  appointmentTitle: apptForIcs.title,
                  description: apptForIcs.description,
                  externalUrl: apptForIcs.externalUrl,
                }}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          When you have finished on the booking site, click{" "}
          <span className="font-medium">I've finished booking</span> to continue.
        </p>
      )}

      <dialog
        ref={dialogRef}
        className="fixed left-1/2 top-1/2 z-50 w-[min(100vw-2rem,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClose={() => setStep("form")}
      >
        {step === "form" ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Confirm appointment
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Choose the date and time of your visit (future times only).
            </p>
            <div className="grid gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Date
                </label>
                <Input
                  type="date"
                  min={tomorrowYmdLocal()}
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
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="button" onClick={goPreview}>
                Continue
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Review
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Your appointment will be:{" "}
              <span className="font-medium">
                {previewCombined
                  ? formatAppointmentDateTime(previewCombined)
                  : "—"}
              </span>
              . Is this correct?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("form")}
                disabled={submitting}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={confirmAppointment}
                disabled={submitting}
              >
                {submitting ? "Saving…" : "Confirm"}
              </Button>
            </div>
          </div>
        )}
      </dialog>

      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-[60] max-w-sm rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 shadow-md dark:border-emerald-900 dark:bg-emerald-950/90 dark:text-emerald-100"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
