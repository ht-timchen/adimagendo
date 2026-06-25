"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const rows = [
  { label: "🟢 Active", text: "Participant is active in the study." },
  { label: "⚫ Withdrawn", text: "Participant has withdrawn from the study." },
] as const;

export function ParticipantStatusLegend() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative inline-flex items-center gap-1.5">
      <span>Status</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full text-slate-400 hover:bg-brand-surface hover:text-brand"
        aria-expanded={open}
        aria-label="What status means"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <HelpCircle className="h-4 w-4" />
      </Button>
      {open ? (
        <div
          className={cn(
            "absolute left-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg shadow-slate-200/80"
          )}
          role="dialog"
          aria-label="Participant status definitions"
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Status definitions
          </p>
          <ul className="space-y-2.5 text-xs text-slate-700">
            {rows.map((r) => (
              <li key={r.label} className="leading-snug">
                <span className="font-semibold text-slate-900">{r.label}</span>
                <span className="text-slate-600"> — {r.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
