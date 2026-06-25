"use client";

import { useEffect, useState } from "react";
import {
  usePushNotification,
  type PushSubscribeResult,
} from "@/hooks/usePushNotification";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  participantDashboardCardClassName,
  participantDashboardHeadingClassName,
  participantDashboardMutedClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";

function messageForError(
  result: Extract<PushSubscribeResult, { ok: false }>
): string {
  switch (result.error) {
    case "permission_denied":
      return "Notifications are blocked. You can turn them on in your browser settings.";
    case "server_error":
      return "We couldn't save your settings. Please try again in a moment.";
    case "missing_vapid":
      return "Push notifications aren't available in this environment yet.";
    case "registration_failed":
      return "We couldn't prepare the app for notifications. Try refreshing the page.";
    case "sync_failed":
      return "We couldn't refresh your notification subscription for this account. Please try again.";
    case "not_supported":
      return "Your browser doesn't support notifications.";
    case "invalid_subscription":
    case "subscribe_failed":
    case "unsubscribe_failed":
    default:
      return result.message ?? "Something went wrong. Please try again.";
  }
}

export function PushNotificationOptIn() {
  const { isSupported, isSubscribed, subscribe, unsubscribe } =
    usePushNotification();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (
      feedback !== "Notifications enabled!" &&
      feedback !== "Notifications disabled."
    )
      return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  if (!isSupported) return null;

  return (
    <Card className={participantDashboardCardClassName}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className={cn("text-base", participantDashboardHeadingClassName)}>Push notifications</CardTitle>
        <Bell className="h-5 w-5 text-[#2F8F7A]" />
      </CardHeader>
      <CardContent className="space-y-3">
        {isSubscribed ? (
          <div className="space-y-3">
            {feedback === "Notifications enabled!" && (
              <p className="text-sm font-medium text-emerald-600">
                Notifications enabled!
              </p>
            )}
            <p className={cn("text-sm", participantDashboardMutedClassName)}>
              Notifications are enabled
            </p>
            <Button
              type="button"
              variant="outline"
              className="border-[#2F8F7A]/40 text-[#1E5D50] hover:bg-[#e8f3f0]"
              onClick={async () => {
                setFeedback(null);
                setPending(true);
                const result = await unsubscribe();
                setPending(false);
                if (result.ok) {
                  setFeedback("Notifications disabled.");
                } else {
                  setFeedback(messageForError(result));
                }
              }}
              disabled={pending}
            >
              {pending ? "Disabling…" : "Disable Notifications"}
            </Button>
            {feedback &&
              feedback !== "Notifications enabled!" &&
              feedback !== "Notifications disabled." && (
                <p className="text-sm text-amber-800">
                  {feedback}
                </p>
              )}
          </div>
        ) : (
          <>
            <p className={cn("text-sm", participantDashboardMutedClassName)}>
              Get study updates on this device when we send them.
            </p>
            <Button
              type="button"
              onClick={async () => {
                setFeedback(null);
                setPending(true);
                const result = await subscribe();
                setPending(false);
                if (result.ok) {
                  setFeedback("Notifications enabled!");
                } else {
                  setFeedback(messageForError(result));
                }
              }}
              disabled={pending}
            >
              {pending ? "Enabling…" : "Enable Notifications"}
            </Button>
            {feedback && (
              <p
                className={`text-sm ${
                  feedback === "Notifications enabled!" ||
                  feedback === "Notifications disabled."
                    ? "text-emerald-600"
                    : "text-amber-800"
                }`}
              >
                {feedback}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
