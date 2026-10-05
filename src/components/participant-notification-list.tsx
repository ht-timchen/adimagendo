"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ADELAIDE_TIME_ZONE } from "@/lib/dates/adelaide-calendar";
import type { ParticipantNotificationItem } from "@/lib/notifications/broadcast-notifications";
import {
  participantDashboardCardClassName,
  participantDashboardMutedClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";

const sentAtFormat = new Intl.DateTimeFormat("en-AU", {
  timeZone: ADELAIDE_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function ParticipantNotificationList({ items }: { items: ParticipantNotificationItem[] }) {
  const router = useRouter();
  const [markedRead, setMarkedRead] = useState<ReadonlySet<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function markRead(id: string) {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
      if (!res.ok) {
        setError("Couldn't mark this notification as read. Please try again.");
        return;
      }
      setMarkedRead((prev) => new Set(prev).add(id));
      // Re-read the page data so the unread number in the header updates too.
      startTransition(() => router.refresh());
    } catch {
      setError("Couldn't mark this notification as read. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <Card className={participantDashboardCardClassName}>
        <CardContent className={cn("py-8 text-center", participantDashboardMutedClassName)}>
          <p>No notifications yet. Messages from the study team will appear here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <ul className="space-y-3">
        {items.map((item) => {
          const read = item.read || markedRead.has(item.id);
          return (
            <li key={item.id}>
              <Card
                className={cn(
                  participantDashboardCardClassName,
                  !read && "border-l-4 border-l-[#C45C26]"
                )}
              >
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <h2 className="min-w-0 break-words text-base font-semibold text-[#17483F]">{item.title}</h2>
                    {!read ? (
                      <span className="shrink-0 rounded-full bg-[#C45C26] px-2 py-0.5 text-xs font-semibold text-white">
                        New
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-[#2A6F60]">Read</span>
                    )}
                  </div>
                  {item.body ? (
                    <p className="whitespace-pre-wrap break-words text-sm text-[#17483F]">{item.body}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <time dateTime={item.createdAt} className={cn("text-xs", participantDashboardMutedClassName)}>
                      {sentAtFormat.format(new Date(item.createdAt))}
                    </time>
                    {!read ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        disabled={busyId === item.id}
                        onClick={() => markRead(item.id)}
                      >
                        {busyId === item.id ? "Marking…" : "Mark as read"}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
