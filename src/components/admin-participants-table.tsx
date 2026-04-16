"use client";

import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Participant = {
  id: string;
  name: string | null;
  email: string;
  createdAt: Date;
  profile?: {
    id: string;
  } | null;
};

type Props = {
  participants: Participant[];
};

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const localPrefix = local.slice(0, 1);
  const domainParts = domain.split(".");
  const domainName = domainParts[0] ?? "";
  const tld = domainParts.slice(1).join(".");
  const maskedDomain = domainName ? `${domainName.slice(0, 1)}***` : "***";
  return `${localPrefix}***@${maskedDomain}${tld ? `.${tld}` : ""}`;
}

function getStudyId(p: Participant): string {
  const source = p.profile?.id ?? p.id;
  return `STUDY-${source.slice(-6).toUpperCase()}`;
}

export function AdminParticipantsTable({ participants }: Props) {
  const [sendingUserId, setSendingUserId] = useState<string | null>(null);
  const [composerUserId, setComposerUserId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const rows = useMemo(
    () =>
      participants.map((p) => ({
        ...p,
        studyId: getStudyId(p),
        maskedEmail: maskEmail(p.email),
        joinedDate: new Date(p.createdAt).toLocaleDateString(),
      })),
    [participants]
  );

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 2500);
  };

  const sendNotification = async (userId: string) => {
    setSendingUserId(userId);
    try {
      const payload: {
        title: string;
        message?: string;
        url: string;
        userId: string;
      } = {
        title: draftTitle.trim(),
        url: "/",
        userId,
      };
      const trimmedMessage = draftMessage.trim();
      if (trimmedMessage) {
        payload.message = trimmedMessage;
      }

      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const serverMsg =
          typeof data.error === "string" ? data.error.trim() : "";
        const noSubscription =
          res.status === 404 &&
          serverMsg.toLowerCase().includes("no active push subscription");
        showToast(
          "error",
          noSubscription
            ? "This participant has disabled notifications."
            : serverMsg || "Failed to send notification."
        );
        return;
      }
      showToast("success", "Notification sent successfully.");
      setComposerUserId(null);
      setDraftTitle("");
      setDraftMessage("");
    } catch {
      showToast("error", "Failed to send notification.");
    } finally {
      setSendingUserId(null);
    }
  };

  return (
    <div className="relative">
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 rounded-md border px-4 py-2 text-sm shadow-md ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {toast.type === "success" ? "✅ " : "❌ "}
          {toast.text}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-900/40">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-slate-600 dark:text-slate-300">
                Study ID
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-slate-600 dark:text-slate-300">
                Masked email
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-slate-600 dark:text-slate-300">
                Joined date
              </th>
              <th className="px-4 py-2 text-right text-sm font-medium text-slate-600 dark:text-slate-300">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-900 dark:bg-slate-950/40">
            {rows.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                    <p className="font-medium">{p.studyId}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {p.name?.trim() || "Name not provided"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                    {p.maskedEmail}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                    {p.joinedDate}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {composerUserId === p.id ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => sendNotification(p.id)}
                          disabled={
                            sendingUserId === p.id ||
                            !draftTitle.trim()
                          }
                        >
                          {sendingUserId === p.id ? "Sending..." : "Send"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setComposerUserId(null);
                            setDraftTitle("");
                            setDraftMessage("");
                          }}
                          disabled={sendingUserId === p.id}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setComposerUserId(p.id);
                          setDraftTitle("");
                          setDraftMessage("");
                        }}
                      >
                        Send Notification
                      </Button>
                    )}
                  </td>
                </tr>
                {composerUserId === p.id && (
                  <tr className="bg-slate-50/60 dark:bg-slate-900/40">
                    <td colSpan={4} className="px-4 py-3">
                      <div className="grid gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            Title
                          </label>
                          <Input
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            placeholder="Enter title"
                            disabled={sendingUserId === p.id}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            Message (optional)
                          </label>
                          <Input
                            value={draftMessage}
                            onChange={(e) => setDraftMessage(e.target.value)}
                            placeholder="Enter notification message"
                            disabled={sendingUserId === p.id}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  No participants found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
