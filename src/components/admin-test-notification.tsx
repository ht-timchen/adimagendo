"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ApiResponse = {
  ok?: boolean;
  error?: string;
  sent?: number;
  removed?: number;
  failed?: number;
};

export function AdminTestNotification() {
  const [userId, setUserId] = useState("");
  const [sendToAll, setSendToAll] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Send test notification</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <label
            htmlFor="push-user-id"
            className="text-sm text-slate-700 dark:text-slate-300"
          >
            User ID (leave blank if sending to all)
          </label>
          <Input
            id="push-user-id"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="cuid user id"
            disabled={isSending || sendToAll}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={sendToAll}
            onChange={(e) => setSendToAll(e.target.checked)}
            disabled={isSending}
          />
          Send to all subscribers
        </label>

        <Button
          type="button"
          disabled={isSending || (!sendToAll && !userId.trim())}
          onClick={async () => {
            setIsSending(true);
            setFeedback(null);
            setIsError(false);
            try {
              const payload: {
                title: string;
                body: string;
                url: string;
                userId?: string;
              } = {
                title: "Test",
                body: "Hello from ADIMAGENDO!",
                url: "/",
              };
              if (!sendToAll && userId.trim()) payload.userId = userId.trim();

              const res = await fetch("/api/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });

              const data = (await res.json().catch(() => ({}))) as ApiResponse;
              if (!res.ok) {
                setIsError(true);
                setFeedback(data.error ?? "Failed to send test notification.");
              } else {
                setFeedback(
                  `Sent: ${data.sent ?? 0}, removed expired: ${data.removed ?? 0}, failed: ${data.failed ?? 0}`
                );
              }
            } catch {
              setIsError(true);
              setFeedback("Failed to send test notification.");
            } finally {
              setIsSending(false);
            }
          }}
        >
          {isSending ? "Sending..." : "Send Test Notification"}
        </Button>

        {feedback && (
          <p
            className={`text-sm ${
              isError
                ? "text-amber-800 dark:text-amber-300"
                : "text-emerald-700 dark:text-emerald-400"
            }`}
          >
            {feedback}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
