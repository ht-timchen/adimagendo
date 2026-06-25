"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  participantDashboardHeadingClassName,
  participantDashboardModalClassName,
  participantDashboardMutedClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";

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
  const [externalSurveyOpened, setExternalSurveyOpened] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function isStandaloneMode(): boolean {
    if (typeof window === "undefined") return false;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return (
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches) ||
      nav.standalone === true
    );
  }

  function openSurveyExternally(): boolean {
    const opened = window.open(surveyUrl, "_blank", "noopener,noreferrer");
    if (opened) {
      setExternalSurveyOpened(true);
      return true;
    }
    return false;
  }

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
        let responseBody: unknown = null;
        try {
          responseBody = await res.json();
        } catch {
          try {
            responseBody = await res.text();
          } catch {
            responseBody = "(unreadable body)";
          }
        }
        console.error("[checklist/complete] mark failed", {
          status: res.status,
          statusText: res.statusText,
          body: responseBody,
          templateId,
        });
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
      className="participant-portal-light fixed inset-0 z-[200] bg-black/40 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="REDCap survey"
    >
      <div
        className={cn(
          "mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden",
          participantDashboardModalClassName
        )}
      >
        <div className="flex items-center justify-between border-b border-[#2F8F7A]/20 px-3 py-2">
          <p className={cn("text-sm font-medium", participantDashboardHeadingClassName)}>
            Pre-screening survey
          </p>
          <div className="flex items-center gap-2">
            <a
              href={surveyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center justify-center rounded-md border border-[#2F8F7A]/30 px-3 text-xs font-medium text-[#17483F] hover:bg-[#2F8F7A]/10"
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
      className="participant-portal-light fixed inset-0 z-[210] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Survey completion confirmation"
    >
      <div className={cn("w-full max-w-sm p-4", participantDashboardModalClassName)}>
        <p className={cn("font-medium", participantDashboardHeadingClassName)}>
          Did you complete the survey?
        </p>
        {isStandaloneMode() ? (
          <p className={cn("mt-2 text-sm", participantDashboardMutedClassName)}>
            After finishing in your browser, tap &ldquo;Yes, mark complete&rdquo;
            to save your progress here.
          </p>
        ) : null}
        {!externalSurveyOpened ? (
          <p className="mt-2 text-sm">
            <a
              href={surveyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#2F8F7A] underline-offset-2 hover:underline"
              onClick={() => setExternalSurveyOpened(true)}
            >
              Open survey
            </a>
          </p>
        ) : null}
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
          <p className="mt-2 text-sm text-amber-800">{error}</p>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button
        type="button"
        className="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover active:bg-brand-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabledProp}
        onClick={() => {
          if (disabledProp) return;
          if (isStandaloneMode()) {
            if (!externalSurveyOpened) {
              openSurveyExternally();
            }
            setOpenConfirm(true);
            setError(null);
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
