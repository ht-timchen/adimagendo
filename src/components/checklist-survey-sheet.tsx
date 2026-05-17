"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

type Props = {
  surveyUrl: string;
  triggerLabel?: string;
  disabled?: boolean;
} & (
  | { templateId: string; surveyId?: never }
  | { surveyId: string; templateId?: never }
);

export function ChecklistSurveySheet({
  templateId,
  surveyId,
  surveyUrl,
  triggerLabel = "Complete survey",
  disabled: disabledProp = false,
}: Props) {
  const router = useRouter();
  const [openSurvey, setOpenSurvey] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCloseSurvey = () => {
    setOpenSurvey(false);
    setOpenConfirm(true);
    setError(null);
  };

  const markCompleted = async () => {
    if (disabledProp) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = templateId
        ? await fetch("/api/checklist/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ templateId }),
          })
        : await fetch(`/api/surveys/${surveyId}/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              answers: {
                selfReportedCompletion: true,
                source: "survey_sheet_confirm_dialog",
                confirmedAt: new Date().toISOString(),
              },
            }),
          });
      if (!res.ok) {
        setError("Could not mark complete. Please try again.");
        return;
      }
      setOpenConfirm(false);
      router.refresh();
    } catch {
      setError("Could not mark complete. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const surveyModal = openSurvey ? (
    <div
      className="fixed inset-0 z-[200] bg-black/40 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="REDCap survey"
    >
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-slate-950">
        <div className="flex items-center justify-between border-b px-3 py-2 dark:border-slate-800">
          <p className="text-sm font-medium">Pre-screening survey</p>
          <div className="flex items-center gap-2">
            <a
              href={surveyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              Open in new tab
            </a>
            <Button type="button" variant="outline" size="sm" onClick={onCloseSurvey}>
              Close
            </Button>
          </div>
        </div>
        <iframe
          src={surveyUrl}
          className="h-full w-full border-0"
          title="REDCap Pre-screening Survey"
        />
      </div>
    </div>
  ) : null;

  const confirmModal = openConfirm ? (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Survey completion confirmation"
    >
      <div className="w-full max-w-sm rounded-lg border bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <p className="font-medium text-slate-900 dark:text-slate-100">
          Did you complete the survey?
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={markCompleted}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Yes, mark complete"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setOpenConfirm(false);
              setError(null);
            }}
            disabled={isSaving}
          >
            Not yet
          </Button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">{error}</p>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button
        type="button"
        className="h-9 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabledProp}
        onClick={() => {
          if (disabledProp) return;
          const nav = window.navigator as Navigator & { standalone?: boolean };
          const isStandaloneMode =
            (typeof window.matchMedia === "function" &&
              window.matchMedia("(display-mode: standalone)").matches) ||
            nav.standalone === true;
          if (isStandaloneMode) {
            window.location.assign(surveyUrl);
            return;
          }
          setOpenSurvey(true);
          setError(null);
        }}
      >
        {triggerLabel}
      </Button>
      {typeof document !== "undefined" ? createPortal(surveyModal, document.body) : surveyModal}
      {typeof document !== "undefined" ? createPortal(confirmModal, document.body) : confirmModal}
    </>
  );
}
