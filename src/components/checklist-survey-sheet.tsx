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
  templateId: string;
  surveyUrl: string;
  triggerLabel?: string;
  disabled?: boolean;
};

const triggerClassName =
  "h-9 rounded-lg bg-participant-button px-4 text-sm font-medium text-white hover:bg-participant-button-hover active:bg-participant-button-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-participant-primary/50 focus-visible:ring-offset-2";

export function ChecklistSurveySheet({
  templateId,
  surveyUrl,
  triggerLabel = "Complete survey",
  disabled: disabledProp = false,
}: Props) {
  const router = useRouter();
  const [openConfirm, setOpenConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markCompleted = async () => {
    if (disabledProp) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/checklist/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
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
        <p className={cn("mt-2 text-sm", participantDashboardMutedClassName)}>
          After finishing in your browser, tap &ldquo;Yes, mark complete&rdquo;
          to save your progress here.
        </p>
        <p className="mt-2 text-sm">
          <a
            href={surveyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-participant-primary underline-offset-2 hover:underline"
          >
            Reopen survey
          </a>
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
          <p className="mt-2 text-sm text-amber-800">{error}</p>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      {disabledProp ? (
        <Button type="button" className={triggerClassName} disabled locked>
          {triggerLabel}
        </Button>
      ) : (
        <a
          href={surveyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("inline-flex items-center justify-center", triggerClassName)}
          onClick={() => {
            setOpenConfirm(true);
            setError(null);
          }}
        >
          {triggerLabel}
          <span className="sr-only"> (opens in new tab)</span>
        </a>
      )}
      {typeof document !== "undefined" ? createPortal(confirmModal, document.body) : confirmModal}
    </>
  );
}
