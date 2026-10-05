"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { formatUnreadBadge, notificationsLinkAriaLabel } from "@/lib/notifications/broadcast-notifications";
import { cn } from "@/lib/utils";

/** Header entry to the participant's notifications. Separate from the News bell and its count. */
export function ParticipantNotificationsLink({ unreadCount }: { unreadCount: number }) {
  const badge = formatUnreadBadge(unreadCount);

  return (
    <Link
      href="/dashboard/notifications"
      aria-label={notificationsLinkAriaLabel(unreadCount)}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-md",
        "text-[#17483F] transition-colors hover:bg-[#e8f3f0] hover:text-[#2F8F7A]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F8F7A]/45 focus-visible:ring-offset-2"
      )}
    >
      <Inbox className="h-4 w-4" aria-hidden />
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
