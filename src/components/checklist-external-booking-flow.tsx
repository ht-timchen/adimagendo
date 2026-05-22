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
  todayYmdLocal,
} from "@/lib/local-datetime";

export type ChecklistBookingProgress =
  | "NOT_STARTED"
  | "BOOKED_EXTERNALLY"
  | "CONFIRMED";

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
  checklistItemId: string | null;
  templateTitle: string;
  templateDescription: string | null;
  externalUrl: string;
  bookingProgress: ChecklistBookingProgress;
  appointment: AppointmentPayload | null;
  actionsDisabled?: boolean;
};

function statusTone(
  progress: ChecklistBookingProgress
): "muted" | "warn" | "ok" {
  if (progress === "CONFIRMED") return "ok";
  if (progress === "BOOKED_EXTERNALLY") return "warn";
  return "muted";
}

function statusLabelBase(
  progress: ChecklistBookingProgress
): string {
  if (progress === "CONFIRMED") return "Confirmed";
  if (progress === "BOOKED_EXTERNALLY") return "Booked Externally";
  return "Not Started";
}

function confirmedAtIso(appointment: AppointmentPayload | null): string | null {
  if (!appointment) return null;
  return appointment.scheduledStartAt ?? appointment.startAt ?? null;
}

/** Avoid locale/timezone mismatch between SSR and client for confirmed dates. */
function BookingProgressBadge({
  progress,
  appointment,
}: {
  progress: ChecklistBookingProgress;
  appointment: AppointmentPayload | null;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const tone = statusTone(progress);
  const badgeClass =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-100 dark:ring-emerald-900"
      : tone === "warn"
        ? "bg-amber-50 text-amber-950 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900"
        : "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700";

  let text = statusLabelBase(progress);
  if (mounted && progress === "CONFIRMED") {
    const iso = confirmedAtIso(appointment);
    if (iso) {
      text = `Confirmed (${formatAppointmentDateTime(new Date(iso))})`;
    }
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${badgeClass}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {text}
    </div>
  );
}

export function ChecklistExternalBookingFlow({
  templateId,
  checklistItemId,
  templateTitle,
  templateDescription,
  externalUrl,
  bookingProgress: initialProgress,
  appointment: initialAppointment,
  actionsDisabled = false,
}: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [bookingProgress, setBookingProgress] =
    useState<ChecklistBookingProgress>(initialProgress);
  const [appointment, setAppointment] = useState<AppointmentPayload | null>(
    initialAppointment
  );
  const [itemId, setItemId] = useState<string | null>(checklistItemId);
  const [bookingNow, setBookingNow] = useState(false);
  const [step, setStep] = useState<"form" | "preview">("form");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setBookingProgress(initialProgress);
    setAppointment(initialAppointment);
    setItemId(checklistItemId);
  }, [initialProgress, initialAppointment, checklistItemId]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const openModal = () => {
    if (actionsDisabled) return;
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

  const onBookNow = async () => {
    if (actionsDisabled) return;
    window.open(externalUrl, "_blank", "noopener,noreferrer");
    setBookingNow(true);
    try {
      const res = await fetch("/api/checklist/book-externally", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) return;
      const data = (await res.json().catch(() => ({}))) as {
        checklistItemId?: string;
      };
      setBookingProgress("BOOKED_EXTERNALLY");
      if (data.checklistItemId) setItemId(data.checklistItemId);
      router.refresh();
    } finally {
      setBookingNow(false);
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
    if (actionsDisabled) return;
    const combined = combineLocalDateTime(dateStr, timeStr);
    if (!combined) return;

    const resolvedItemId = itemId ?? checklistItemId;
    if (!resolvedItemId) {
      showToast("Checklist item not found. Tap Book Now again.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/appointments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklistItemId: resolvedItemId,
          scheduledStartAt: combined.toISOString(),
          scheduledLocation: location.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        appointmentId?: string;
        scheduledStartAt?: string | null;
        alreadyCompleted?: boolean;
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
      showToast(
        "Appointment confirmed! Add it to your calendar below."
      );
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

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
      <BookingProgressBadge progress={bookingProgress} appointment={appointment} />

      <div className="flex flex-wrap items-center gap-2">
        {bookingProgress === "NOT_STARTED" ? (
          <Button
            type="button"
            size="sm"
            disabled={actionsDisabled || bookingNow}
            onClick={onBookNow}
          >
            {bookingNow ? "Saving…" : "Book Now"}
            <ExternalLink className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center rounded-md bg-slate-100 px-3 text-sm font-medium hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            Open booking site <ExternalLink className="ml-1 h-4 w-4" />
          </a>
        )}
      </div>

      {showExpandedPanel ? (
        <div className="rounded-md border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          {bookingProgress === "BOOKED_EXTERNALLY" ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Enter the date and time from your booking confirmation.
              </p>
              <Button
                type="button"
                size="sm"
                disabled={actionsDisabled}
                onClick={openModal}
              >
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
      ) : null}

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
              . Correct?
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
          className="fixed bottom-24 left-1/2 z-[60] max-w-sm -translate-x-1/2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 shadow-md dark:border-emerald-900 dark:bg-emerald-950/90 dark:text-emerald-100 md:bottom-6 md:left-auto md:right-6 md:translate-x-0"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
