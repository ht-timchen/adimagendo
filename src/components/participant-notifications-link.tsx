"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { formatUnreadBadge, notificationsLinkAriaLabel } from "@/lib/notifications/broadcast-notifications";
import { cn } from "@/lib/utils";
import { participantFocusRingClassName } from "@/lib/participant-dashboard-ui";

/** Header entry to the participant's notifications. Separate from the News bell and its count. */
export function ParticipantNotificationsLink({ unreadCount }: { unreadCount: number }) {
  const badge = formatUnreadBadge(unreadCount);

  return (
    <Link
      href="/dashboard/notifications"
      aria-label={notificationsLinkAriaLabel(unreadCount)}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-md",
        "text-participant-ink transition-colors hover:bg-participant-surface hover:text-participant-primary",
        participantFocusRingClassName
      )}
    >
      <Inbox className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
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
