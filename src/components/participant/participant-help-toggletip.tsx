"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { participantFocusRingClassName } from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";

/**
 * Heading with a "?" button that reveals supplementary help inline below it (a disclosure,
 * not a floating bubble, so it never clips on small screens). Collapsed by default; closes on
 * a second tap, Escape, or a tap outside. Essential instructions must stay outside `children`.
 */
export function ParticipantHelpToggletip({
  heading,
  sectionName,
  children,
  className,
}: {
  heading: ReactNode;
  sectionName: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      if (rootRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={className}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">{heading}</div>
        <button
          ref={buttonRef}
          type="button"
          aria-label={`More information about ${sectionName}`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "-my-2.5 -mr-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-participant-primary transition-colors hover:bg-participant-surface-strong",
            open && "bg-participant-surface-strong",
            participantFocusRingClassName
          )}
        >
          <CircleHelp className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <div
        id={panelId}
        hidden={!open}
        className="mt-2 rounded-xl border border-participant-primary/15 bg-participant-surface px-3 py-2.5 text-sm text-participant-ink"
      >
        {children}
      </div>
    </div>
  );
}
