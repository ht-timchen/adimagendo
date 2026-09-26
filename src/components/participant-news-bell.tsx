"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import {
  formatNewsBadgeCount,
  newsBadgeAriaLabel,
} from "@/lib/news/news-badge";
import { cn } from "@/lib/utils";

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
        "text-[#17483F] transition-colors hover:bg-[#e8f3f0] hover:text-[#2F8F7A]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F8F7A]/45 focus-visible:ring-offset-2"
      )}
    >
      <Bell className="h-4 w-4" aria-hidden />
      {badge ? (
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center",
            "rounded-full bg-[#C45C26] px-1 text-[10px] font-semibold leading-none text-white"
          )}
          aria-hidden
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
