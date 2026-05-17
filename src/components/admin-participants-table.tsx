"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, ChevronDown, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { participantStatusDisplay, type ParticipantStudyStatus } from "@/lib/admin-display";
import { ParticipantStatusLegend } from "@/components/admin/participant-status-legend";

export type ParticipantRow = {
  id: string;
  name: string | null;
  email: string;
  recordId: string;
  enrollmentDate: string | null;
  dateOfBirth: string | null;
  checklistCompleted: number;
  checklistTotal: number;
  currentStep: string | null;
  status: ParticipantStudyStatus;
};

type CredentialsPayload = {
  email: string;
  temporaryPassword: string;
  title: string;
};

const MENU_WIDTH = 220;
const MENU_GAP = 6;

export function AdminParticipantsTable({ participants }: { participants: ParticipantRow[] }) {
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialsPayload | null>(null);
  const [notifyParticipant, setNotifyParticipant] = useState<ParticipantRow | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftMessage, setDraftMessage] = useState("");

  const showToast = useCallback((type: "success" | "error", text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  async function resetPassword(p: ParticipantRow) {
    if (!confirm(`Generate a new temporary password for ${p.name?.trim() || p.email}?`)) {
      return;
    }
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/admin/participants/${p.id}/reset-password`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        error?: string;
        email?: string;
        temporaryPassword?: string;
      };
      if (!res.ok || !data.temporaryPassword || !data.email) {
        showToast("error", data.error ?? "Failed to reset password");
        return;
      }
      setCredentials({
        email: data.email,
        temporaryPassword: data.temporaryPassword,
        title: "Temporary password",
      });
      showToast("success", "Temporary password generated");
    } catch {
      showToast("error", "Network error");
    }
    setBusyId(null);
  }

  async function submitNotification() {
    if (!notifyParticipant || !draftTitle.trim()) return;
    setBusyId(notifyParticipant.id);
    try {
      const payload: { title: string; message?: string; url: string; userId: string } = {
        title: draftTitle.trim(),
        url: "/",
        userId: notifyParticipant.id,
      };
      const trimmedMessage = draftMessage.trim();
      if (trimmedMessage) payload.message = trimmedMessage;

      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const serverMsg = typeof data.error === "string" ? data.error.trim() : "";
        const noSubscription =
          res.status === 404 && serverMsg.toLowerCase().includes("no active push subscription");
        showToast(
          "error",
          noSubscription
            ? "This participant has disabled notifications."
            : serverMsg || "Failed to send notification."
        );
        return;
      }
      showToast("success", "Notification sent");
      setNotifyParticipant(null);
      setDraftTitle("");
      setDraftMessage("");
    } catch {
      showToast("error", "Failed to send notification");
    }
    setBusyId(null);
  }

  return (
    <div className="relative">
      {toast ? (
        <div
          role="status"
          className={cn(
            "fixed bottom-6 right-6 z-50 rounded-xl border px-4 py-2 text-sm shadow-lg",
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          )}
        >
          {toast.text}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-md shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950/40">
        <table className="min-w-[1280px] w-full text-left text-sm">
          <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/40">
            <tr>
              <th className="px-4 py-3">Record ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">
                <ParticipantStatusLegend />
              </th>
              <th className="px-4 py-3">Enrollment date</th>
              <th className="px-4 py-3">Checklist</th>
              <th className="px-4 py-3">Current step</th>
              <th className="px-4 py-3">Date of birth</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
            {participants.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                  No participants found.
                </td>
              </tr>
            ) : (
              participants.map((p) => {
                const sd = participantStatusDisplay(p.status);
                return (
                <tr
                  key={p.id}
                  className={cn(
                    "hover:bg-slate-50/60 dark:hover:bg-slate-900/30",
                    p.status === "withdrawn" && "bg-slate-50/80 opacity-75"
                  )}
                >
                  <td className="px-4 py-3 font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                    {p.recordId}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {p.name?.trim() || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", sd.dot)} />
                      <span className="text-slate-700 dark:text-slate-300">{sd.label}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {p.enrollmentDate ?? "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-800 dark:text-slate-200">
                    {p.checklistTotal > 0 ? (
                      <span>
                        {p.checklistCompleted} of {p.checklistTotal}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="max-w-[200px] px-4 py-3 text-slate-700 dark:text-slate-300">
                    <span className="line-clamp-2">{p.currentStep ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {p.dateOfBirth ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ParticipantRowActions
                      busy={busyId === p.id}
                      onResetPassword={() => resetPassword(p)}
                      onSendNotification={() => {
                        setNotifyParticipant(p);
                        setDraftTitle("");
                        setDraftMessage("");
                      }}
                    />
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>

      {credentials ? (
        <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />
      ) : null}

      {notifyParticipant ? (
        <NotifyModal
          participant={notifyParticipant}
          title={draftTitle}
          message={draftMessage}
          busy={busyId === notifyParticipant.id}
          onTitleChange={setDraftTitle}
          onMessageChange={setDraftMessage}
          onClose={() => {
            if (busyId === notifyParticipant.id) return;
            setNotifyParticipant(null);
            setDraftTitle("");
            setDraftMessage("");
          }}
          onSubmit={submitNotification}
        />
      ) : null}
    </div>
  );
}

function ParticipantRowActions({
  busy,
  onResetPassword,
  onSendNotification,
}: {
  busy: boolean;
  onResetPassword: () => void;
  onSendNotification: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight ?? 100;
    const viewportPad = 12;
    let top = rect.bottom + MENU_GAP;
    if (top + menuHeight > window.innerHeight - viewportPad) {
      top = rect.top - MENU_GAP - menuHeight;
    }
    top = Math.max(viewportPad, Math.min(top, window.innerHeight - menuHeight - viewportPad));
    let left = rect.right - MENU_WIDTH;
    left = Math.max(viewportPad, Math.min(left, window.innerWidth - MENU_WIDTH - viewportPad));
    setMenuPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    function onScrollOrResize() {
      updateMenuPosition();
    }
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const items = [
    {
      key: "reset",
      label: "Reset password",
      icon: <KeyRound className="h-4 w-4" />,
      onClick: () => {
        setOpen(false);
        onResetPassword();
      },
    },
    {
      key: "notify",
      label: "Send notification",
      icon: <Bell className="h-4 w-4" />,
      onClick: () => {
        setOpen(false);
        onSendNotification();
      },
    },
  ];

  return (
    <div ref={triggerRef} className="inline-block text-left">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn("rounded-xl", open && "border-violet-300 bg-violet-50")}
        disabled={busy}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        Actions
        <ChevronDown className={cn("ml-1.5 h-4 w-4 transition-transform", open && "rotate-180")} />
      </Button>
      {mounted && open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={
                menuPos
                  ? {
                      position: "fixed",
                      top: menuPos.top,
                      left: menuPos.left,
                      width: MENU_WIDTH,
                      zIndex: 9999,
                    }
                  : { position: "fixed", visibility: "hidden", width: MENU_WIDTH, zIndex: 9999 }
              }
              className="rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-300/40 ring-1 ring-slate-900/5"
            >
              {items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={item.onClick}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function CredentialsModal({
  credentials,
  onClose,
}: {
  credentials: CredentialsPayload;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied("error");
    }
  }

  const shareText = `ADIMAGENDO participant login\nEmail: ${credentials.email}\nTemporary password: ${credentials.temporaryPassword}`;

  return (
    <ModalShell title={credentials.title} onClose={onClose}>
      <p className="text-sm text-slate-600">
        Share these credentials with the participant. This password is shown once.
      </p>
      <div className="mt-4 space-y-3">
        <CredentialRow
          label="Email"
          value={credentials.email}
          copied={copied === "Email"}
          onCopy={() => copy("Email", credentials.email)}
        />
        <CredentialRow
          label="Temporary password"
          value={credentials.temporaryPassword}
          copied={copied === "Password"}
          onCopy={() => copy("Password", credentials.temporaryPassword)}
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={() => copy("All", shareText)}>
          <Copy className="mr-1.5 h-4 w-4" />
          {copied === "All" ? "Copied" : "Copy all"}
        </Button>
        <Button type="button" className="rounded-xl bg-violet-600" onClick={onClose}>
          Done
        </Button>
      </div>
    </ModalShell>
  );
}

function NotifyModal({
  participant,
  title,
  message,
  busy,
  onTitleChange,
  onMessageChange,
  onClose,
  onSubmit,
}: {
  participant: ParticipantRow;
  title: string;
  message: string;
  busy: boolean;
  onTitleChange: (v: string) => void;
  onMessageChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <ModalShell title="Send notification" onClose={onClose}>
      <p className="text-sm text-slate-600">
        Push notification to{" "}
        <span className="font-medium text-slate-900">
          {participant.name?.trim() || participant.email}
        </span>
      </p>
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Title</label>
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Notification title"
            disabled={busy}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Message (optional)
          </label>
          <Input
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Notification message"
            disabled={busy}
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="button"
          className="rounded-xl bg-violet-600"
          disabled={busy || !title.trim()}
          onClick={onSubmit}
        >
          {busy ? "Sending…" : "Send"}
        </Button>
      </div>
    </ModalShell>
  );
}

function CredentialRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <code className="break-all text-sm text-slate-900">{value}</code>
        <Button type="button" size="sm" variant="outline" className="shrink-0 rounded-lg" onClick={onCopy}>
          <Copy className="mr-1 h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
