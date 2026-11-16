"use client";

import { useEffect } from "react";
import { isChecklistItemAnchorId } from "@/lib/participant/search-index";

const HIGHLIGHT_MS = 2500;

/**
 * Opens the collapsed sections around a #checklist-item-<key> target, scrolls to it and
 * moves focus there. iOS Safari does not open closed <details> for fragment links, so
 * the parents are opened explicitly.
 */
export function ChecklistHashTarget() {
  useEffect(() => {
    let frame = 0;
    let timer = 0;

    function reveal() {
      let id: string;
      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      if (!isChecklistItemAnchorId(id)) return;
      const target = document.getElementById(id);
      if (!target) return;

      for (let el = target.parentElement; el; el = el.parentElement) {
        if (el instanceof HTMLDetailsElement && !el.open) el.open = true;
      }

      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      frame = requestAnimationFrame(() => {
        target.scrollIntoView({ block: "start" });
        target.focus({ preventScroll: true });
        target.setAttribute("data-search-target", "");
        timer = window.setTimeout(() => target.removeAttribute("data-search-target"), HIGHLIGHT_MS);
      });
    }

    reveal();
    window.addEventListener("hashchange", reveal);
    return () => {
      window.removeEventListener("hashchange", reveal);
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
