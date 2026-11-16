"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import {
  formatNewsBadgeCount,
  newsBadgeAriaLabel,
} from "@/lib/news/news-badge";
import { cn } from "@/lib/utils";
import { participantFocusRingClassName } from "@/lib/participant-dashboard-ui";

export function ParticipantNewsBell({
  newNewsCount,
}: {
  newNewsCount: number;
}) {
  const pathname = usePathname() ?? "";
  const onNews =
    pathname === "/dashboard/news" || pathname.startsWith("/dashboard/news/");
  const effectiveCount = onNews ? 0 : newNewsCount;
  const badge = formatNewsBadgeCount(effectiveCount);

  return (
    <Link
      href="/dashboard/news"
      aria-label={newsBadgeAriaLabel(effectiveCount)}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-md",
        "text-participant-ink transition-colors hover:bg-participant-surface hover:text-participant-primary",
        participantFocusRingClassName
      )}
    >
      <Bell className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
      {badge ? (
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center",
            "rounded-full bg-[#B5521F] px-1 text-[10px] font-semibold leading-none text-white"
          )}
          aria-hidden
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
