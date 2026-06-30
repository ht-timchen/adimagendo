"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateStudyAppointmentIcs,
  studyAppointmentIcsFilename,
  type StudyAppointmentIcsInput,
} from "@/lib/study-appointment-ics";

function createIcsBlobUrl(icsContent: string): string {
  const blob = new Blob([icsContent], { type: "text/calendar" });
  return URL.createObjectURL(blob);
}

function downloadFromUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

function isIosPwa(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;
  const isIosDevice =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  return isIosDevice && isStandalone;
}

const shareIcs = async (icsContent: string, filename: string) => {
  const blob = new Blob([icsContent], { type: "text/calendar" });
  const file = new File([blob], filename, { type: "text/calendar" });

  const downloadFallback = () => {
    const url = createIcsBlobUrl(icsContent);
    downloadFromUrl(url, filename);
    URL.revokeObjectURL(url);
  };

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Add to Calendar" });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        downloadFallback();
        return;
      }
      throw error;
    }
  } else {
    // Fallback for desktop / unsupported browsers
    downloadFallback();
  }
};

function hasConfirmedDateTime(input: StudyAppointmentIcsInput): boolean {
  return input.startAt instanceof Date && !Number.isNaN(input.startAt.getTime());
}

type Props = {
  input: StudyAppointmentIcsInput;
  status?: "CONFIRMED" | string | null;
  className?: string;
};

export function AddToCalendarButton({ input, status, className }: Props) {
  const isConfirmed = status === undefined ? true : status === "CONFIRMED";
  const [loading, setLoading] = useState(false);
  const [iosPwaFileUrl, setIosPwaFileUrl] = useState<string | null>(null);
  const [awaitingCalendarReturn, setAwaitingCalendarReturn] = useState(false);

  const onClick = useCallback(() => {
    setLoading(true);
    const body = generateStudyAppointmentIcs(input);
    const filename = studyAppointmentIcsFilename(input.appointmentId);

    if (isIosPwa()) {
      const fileUrl = createIcsBlobUrl(body);
      downloadFromUrl(fileUrl, filename);
      setIosPwaFileUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return fileUrl;
      });
      setAwaitingCalendarReturn(true);
      window.location.href = fileUrl;
      setLoading(false);
      return;
    }

    void shareIcs(body, filename).catch((error) => {
      // Ignore user-cancelled share prompts; log unexpected failures.
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Failed to share calendar file", error);
    }).finally(() => {
      setLoading(false);
    });
  }, [input]);

  useEffect(() => {
    if (!awaitingCalendarReturn) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setAwaitingCalendarReturn(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [awaitingCalendarReturn]);

  useEffect(() => {
    return () => {
      if (iosPwaFileUrl) {
        URL.revokeObjectURL(iosPwaFileUrl);
      }
    };
  }, [iosPwaFileUrl]);

  if (!isConfirmed || !hasConfirmedDateTime(input)) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className}
        disabled={loading}
        onClick={onClick}
      >
        <CalendarPlus className="mr-1.5 h-4 w-4" />
        {loading ? "Downloading..." : "Add to Calendar"}
      </Button>
    </>
  );
}
