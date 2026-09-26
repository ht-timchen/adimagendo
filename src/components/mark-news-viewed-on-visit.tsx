"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Marks News as viewed after a real client visit, then refreshes the
 * shared layout badge. Avoids writing on RSC/prefetch of the News page.
 *
 * No abort/cancelled flag: router.refresh() does not remount this tree in the
 * normal case, so `started` stays set and we do not loop. Strict Mode's
 * effect→cleanup→effect would otherwise cancel a successful first request
 * before refresh if we used a cancelled flag.
 */
export function MarkNewsViewedOnVisit() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void fetch("/api/participant/news-viewed", {
      method: "POST",
      credentials: "same-origin",
    }).then((response) => {
      if (response.ok) {
        router.refresh();
      }
    });
  }, [router]);

  return null;
}
