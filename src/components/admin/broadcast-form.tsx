"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  BROADCAST_BODY_MAX,
  BROADCAST_TITLE_MAX,
  broadcastResultMessage,
  type BroadcastOutcome,
} from "@/lib/notifications/broadcast-notifications";
import { cn } from "@/lib/utils";

type Feedback = { tone: "success" | "info" | "error"; text: string };

function newSubmissionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

const FEEDBACK_CLASS: Record<Feedback["tone"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  info: "border-slate-200 bg-slate-50 text-slate-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
};

export function BroadcastForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  // One id per form "attempt". Sending it again (double click, retry after a timeout) is
  // recognised by the server; it only changes after a successful send.
  const submissionId = useRef(newSubmissionId());
  const sendingRef = useRef(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sendingRef.current) return;
    if (!title.trim()) {
      setFeedback({ tone: "error", text: "Title is required." });
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, submissionId: submissionId.current }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        status?: BroadcastOutcome["status"];
        count?: number;
      } | null;

      if (!res.ok || !data?.status) {
        setFeedback({
          tone: "error",
          text:
            data?.error ??
            (res.status === 403
              ? "You don't have permission to send notifications."
              : "Something went wrong and nothing was sent. Your message is still here, so you can try again."),
        });
        return;
      }

      const outcome: BroadcastOutcome =
        data.status === "no-recipients" ? { status: "no-recipients" } : { status: data.status, count: data.count ?? 0 };
      setFeedback(broadcastResultMessage(outcome));
      if (outcome.status !== "no-recipients") {
        setTitle("");
        setBody("");
        submissionId.current = newSubmissionId();
      }
    } catch {
      setFeedback({
        tone: "error",
        text: "Couldn't reach the server. Check the broadcast didn't go through before sending again; your message is still here.",
      });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" aria-busy={sending}>
      <div aria-live="polite" role="status">
        {feedback ? (
          <p className={cn("rounded-xl border px-3 py-2 text-sm", FEEDBACK_CLASS[feedback.tone])}>{feedback.text}</p>
        ) : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="broadcast-title" className="text-xs font-semibold uppercase text-slate-500">
          Title
        </label>
        <input
          id="broadcast-title"
          name="title"
          required
          maxLength={BROADCAST_TITLE_MAX}
          value={title}
          readOnly={sending}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="broadcast-body" className="text-xs font-semibold uppercase text-slate-500">
          Message (optional)
        </label>
        <textarea
          id="broadcast-body"
          name="body"
          rows={4}
          maxLength={BROADCAST_BODY_MAX}
          value={body}
          readOnly={sending}
          onChange={(e) => setBody(e.target.value)}
          className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <Button type="submit" className="w-fit rounded-xl" disabled={sending}>
        {sending ? "Sending…" : "Send to all"}
      </Button>
    </form>
  );
}
