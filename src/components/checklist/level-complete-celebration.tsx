"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import confetti from "canvas-confetti";

const AUTO_DISMISS_MS = 2800;

type LevelNumber = 1 | 2 | 3;

type CompleteResponse = {
  ok?: boolean;
  levelJustCompleted?: LevelNumber | null;
};

function LevelCompleteCelebrationOverlay({
  level,
  onDone,
}: {
  level: LevelNumber;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const burst = () => {
      void confetti({
        particleCount: 120,
        spread: 72,
        origin: { y: 0.6 },
      });
      void confetti({
        particleCount: 80,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
      void confetti({
        particleCount: 80,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });
    };

    burst();
    const secondBurst = window.setTimeout(burst, 220);

    const fadeTimer = window.setTimeout(() => setFading(true), AUTO_DISMISS_MS - 400);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      onDone();
    }, AUTO_DISMISS_MS);

    return () => {
      window.clearTimeout(secondBurst);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [level, onDone]);

  if (!visible) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[300] flex items-center justify-center bg-black/50 transition-opacity duration-[400ms] ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-live="polite"
      aria-label={`Level ${level} complete`}
    >
      <div className="mx-4 rounded-2xl bg-white px-8 py-10 text-center shadow-2xl dark:bg-slate-950">
        <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
          🎉 Level {level} Complete!
        </p>
      </div>
    </div>,
    document.body
  );
}

function isChecklistCompleteRequest(input: RequestInfo | URL, init?: RequestInit) {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  return url.includes("/api/checklist/complete") && method === "POST";
}

export function ChecklistCelebrationRoot({ children }: { children: ReactNode }) {
  const [celebrationLevel, setCelebrationLevel] = useState<LevelNumber | null>(
    null
  );

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);

      if (!isChecklistCompleteRequest(input, init) || !response.ok) {
        return response;
      }

      try {
        const data = (await response.clone().json()) as CompleteResponse;
        const level = data.levelJustCompleted;
        if (level === 1 || level === 2 || level === 3) {
          setCelebrationLevel(level);
        }
      } catch {
        // Ignore parse errors; leave response unchanged for callers.
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <>
      {children}
      {celebrationLevel != null ? (
        <LevelCompleteCelebrationOverlay
          level={celebrationLevel}
          onDone={() => setCelebrationLevel(null)}
        />
      ) : null}
    </>
  );
}
