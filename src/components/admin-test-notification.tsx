"use client";

/**
 * Web push test controls for admins only. Use under /dashboard/admin (see
 * dashboard/admin/layout.tsx); the API route also requires role ADMIN.
 */
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
  target?: string;
  subscriptions?: number;
};

type SuccessSummary = {
  isSuccess: boolean;
  message?: string;
};

function buildSuccessSummary(data: ApiResponse): SuccessSummary {
  const sent = data.sent ?? 0;
  const failed = data.failed ?? 0;
  const removed = data.removed ?? 0;
  if (sent === 0) {
    return {
      isSuccess: false,
      message: "No notifications were delivered.",
    };
  }
  if (failed === 0 && removed === 0) {
    return { isSuccess: true };
  }
  return {
    isSuccess: false,
    message: `Sent to ${sent} device(s), but some deliveries failed or subscriptions expired.`,
  };
}

export function AdminTestNotification() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [successSummary, setSuccessSummary] = useState<SuccessSummary | null>(
    null
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Send test notification</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Send to all subscribers.
        </p>

        <div className="space-y-1">
          <label className="text-sm text-slate-700 dark:text-slate-300">
            Title
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter title"
            disabled={isSending}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-700 dark:text-slate-300">
            Notification message (optional)
          </label>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter message"
            disabled={isSending}
          />
        </div>

        <Button
          type="button"
          disabled={isSending || !title.trim()}
          onClick={async () => {
            setIsSending(true);
            setSuccessSummary(null);
            try {
              const payload: {
                title: string;
                message?: string;
                url: string;
              } = {
                title: title.trim(),
                url: "/",
              };
              const trimmedMessage = message.trim();
              if (trimmedMessage) {
                payload.message = trimmedMessage;
              }

              const res = await fetch("/api/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });

              const data = (await res.json().catch(() => ({}))) as ApiResponse;
              if (!res.ok) {
                setSuccessSummary({
                  isSuccess: false,
                  message:
                    typeof data.error === "string" && data.error.trim()
                      ? data.error.trim()
                      : "Failed to send notification.",
                });
              } else {
                setSuccessSummary(buildSuccessSummary(data));
              }
            } catch {
              setSuccessSummary({
                isSuccess: false,
                message: "Failed to send notification.",
              });
            } finally {
              setIsSending(false);
            }
          }}
        >
          {isSending ? "Sending..." : "Send Test Notification"}
        </Button>

        {successSummary && (
          <div
            className="space-y-2 rounded-md border border-emerald-200/80 bg-emerald-50/80 p-3 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/40"
            role="status"
          >
            <p className="font-medium text-emerald-900 dark:text-emerald-100">
              {successSummary.isSuccess
                ? "✅ Notification sent successfully."
                : `❌ ${successSummary.message ?? "Failed to send notification."}`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
