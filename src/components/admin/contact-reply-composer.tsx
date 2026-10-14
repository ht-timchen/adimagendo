"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BROADCAST_BODY_MAX, BROADCAST_TITLE_MAX } from "@/lib/notifications/broadcast-notifications";
import { cn } from "@/lib/utils";

export const DEFAULT_CONTACT_REPLY_TITLE = "Reply from the AD-IMAGENDO team";

/** Dark brand green: white text on it is about 5.3:1 (the lighter brand green is below 4.5:1). */
const PRIMARY_BUTTON_CLASS =
  "rounded-xl bg-brand-hover text-white hover:bg-brand-active active:bg-brand-active";

type Feedback = { tone: "success" | "warning" | "error"; text: string };

const FEEDBACK_CLASS: Record<Feedback["tone"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-rose-200 bg-rose-50 text-rose-800",
};

function newSubmissionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export type ContactReplyParticipant = {
  name: string | null;
  firstName: string | null;
  email: string;
  studyRecordId: string | null;
};

type ReplyContext = {
  contactMessageId: string;
  participant: ContactReplyParticipant;
  hasReplies: boolean;
  participantActive: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  feedback: Feedback | null;
  setFeedback: (feedback: Feedback | null) => void;
};

const ContactReplyContext = createContext<ReplyContext | null>(null);

function useReplyContext(): ReplyContext {
  const ctx = useContext(ContactReplyContext);
  if (!ctx) throw new Error("Contact reply parts must be inside ContactReplyProvider.");
  return ctx;
}

/** Shares the open/closed state between the header button and the composer under the message. */
export function ContactReplyProvider({
  contactMessageId,
  participant,
  hasReplies,
  participantActive,
  children,
}: {
  contactMessageId: string;
  participant: ContactReplyParticipant;
  hasReplies: boolean;
  participantActive: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  return (
    <ContactReplyContext.Provider
      value={{ contactMessageId, participant, hasReplies, participantActive, open, setOpen, feedback, setFeedback }}
    >
      {children}
    </ContactReplyContext.Provider>
  );
}

export function ContactReplyButton() {
  const { participant, hasReplies, participantActive, open, setOpen, setFeedback } = useReplyContext();
  if (!participantActive || open) return null;

  const label = hasReplies
    ? "Reply again"
    : participant.firstName
      ? `Reply to ${participant.firstName}`
      : "Reply to participant";

  return (
    <Button
      type="button"
      size="sm"
      variant={hasReplies ? "outline" : "default"}
      className={cn("shrink-0", hasReplies ? "rounded-xl" : PRIMARY_BUTTON_CLASS)}
      onClick={() => {
        setFeedback(null);
        setOpen(true);
      }}
    >
      {label}
    </Button>
  );
}

export function ContactReplyComposer() {
  const router = useRouter();
  const { contactMessageId, participant, participantActive, open, setOpen, feedback, setFeedback } =
    useReplyContext();
  const [title, setTitle] = useState(DEFAULT_CONTACT_REPLY_TITLE);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One id per reply attempt. Sending it again (double click, retry after a timeout) is
  // recognised by the server; it only changes after a successful send.
  const submissionId = useRef(newSubmissionId());
  const sendingRef = useRef(false);

  const first = participant.firstName;
  const fullName = participant.name?.trim() || participant.email;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sendingRef.current) return;
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!body.trim()) {
      setError("Message is required.");
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/messages/${encodeURIComponent(contactMessageId)}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, submissionId: submissionId.current }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        tone?: "success" | "warning";
        message?: string;
      } | null;

      if (!res.ok || !data?.message) {
        setError(
          data?.error ??
            (res.status === 403
              ? "You don't have permission to reply to messages."
              : "Something went wrong and nothing was sent. Your text is still here, so you can try again.")
        );
        return;
      }

      setFeedback({ tone: data.tone ?? "success", text: data.message });
      setTitle(DEFAULT_CONTACT_REPLY_TITLE);
      setBody("");
      submissionId.current = newSubmissionId();
      setOpen(false);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check the reply didn't go through before sending again; your text is still here.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div aria-live="polite" role="status">
        {feedback ? (
          <p className={cn("rounded-xl border px-3 py-2 text-sm", FEEDBACK_CLASS[feedback.tone])}>{feedback.text}</p>
        ) : null}
      </div>

      {!participantActive ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          This participant&apos;s account is deactivated, so replies can&apos;t be sent.
        </p>
      ) : null}

      {participantActive && open ? (
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4"
          aria-busy={sending}
          aria-label="Reply to this message"
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500">To</p>
            <p className="break-words text-sm text-slate-900">
              <span className="font-medium">{fullName}</span>
              {participant.name?.trim() ? <span className="text-slate-500"> · {participant.email}</span> : null}
              {participant.studyRecordId ? (
                <span className="text-slate-500"> · Record {participant.studyRecordId}</span>
              ) : null}
            </p>
            <p className="text-xs text-slate-500">This participant only</p>
          </div>

          <div className="space-y-1">
            <label htmlFor="contact-reply-title" className="text-xs font-semibold uppercase text-slate-500">
              Notification title
            </label>
            <input
              id="contact-reply-title"
              name="title"
              required
              maxLength={BROADCAST_TITLE_MAX}
              value={title}
              readOnly={sending}
              onChange={(e) => setTitle(e.target.value)}
              aria-describedby="contact-reply-title-help"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <p id="contact-reply-title-help" className="text-xs text-slate-500">
              Shown in Study Buddy. The phone notification only says there&apos;s a new message from the study team.
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="contact-reply-body" className="text-xs font-semibold uppercase text-slate-500">
              Message
            </label>
            <textarea
              id="contact-reply-body"
              name="body"
              required
              rows={5}
              autoFocus
              maxLength={BROADCAST_BODY_MAX}
              value={body}
              readOnly={sending}
              onChange={(e) => setBody(e.target.value)}
              aria-describedby="contact-reply-body-help"
              className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <p id="contact-reply-body-help" className="text-xs text-slate-500">
              {first ?? "The participant"} reads this in Study Buddy under Notifications. No email is sent.
            </p>
          </div>

          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            For study coordination only. Don&apos;t give clinical advice.
          </p>

          {error ? (
            <p role="alert" className={cn("rounded-xl border px-3 py-2 text-sm", FEEDBACK_CLASS.error)}>
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={sending}>
              {sending ? "Sending…" : first ? `Send to ${first}` : "Send reply"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={sending}
              onClick={() => {
                setError(null);
                setOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
