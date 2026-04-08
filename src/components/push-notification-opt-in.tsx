"use client";

import { useEffect, useState } from "react";
import {
  usePushNotification,
  type PushSubscribeResult,
} from "@/hooks/usePushNotification";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    case "not_supported":
      return "Your browser doesn't support notifications.";
    case "invalid_subscription":
    case "subscribe_failed":
    default:
      return result.message ?? "Something went wrong. Please try again.";
  }
}

export function PushNotificationOptIn() {
  const { isSupported, isSubscribed, subscribe } = usePushNotification();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (feedback !== "Notifications enabled!") return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  if (!isSupported) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Push notifications</CardTitle>
        <Bell className="h-5 w-5 text-violet-600" />
      </CardHeader>
      <CardContent className="space-y-3">
        {isSubscribed ? (
          <div className="space-y-1">
            {feedback === "Notifications enabled!" && (
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Notifications enabled!
              </p>
            )}
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Notifications are enabled
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400">
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
                  feedback === "Notifications enabled!"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-800 dark:text-amber-200"
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
