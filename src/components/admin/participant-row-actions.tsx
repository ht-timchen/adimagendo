"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Copy,
  Eye,
  KeyRound,
  Link as LinkIcon,
  QrCode,
  UserX,
  UserCheck,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ParticipantActionTarget = {
  id: string;
  name: string | null;
  email: string;
  studyRecordId: string;
  isActive: boolean;
};

export type ParticipantActionPermissions = {
  canResetPassword: boolean;
  canSendNotification: boolean;
  canManageEnrolment: boolean;
  canUpdateParticipant: boolean;
};

type CredentialsPayload = {
  email: string;
  temporaryPassword: string;
  title: string;
};

const MENU_WIDTH = 220;
const MENU_GAP = 6;
const DISABLE_REASON_MAX = 50;
import { adminPushSendErrorMessage } from "@/lib/push/admin-push-send-ui";

export function ParticipantActions({
  target,
  permissions,
  variant = "row",
  showViewDetails = true,
}: {
  target: ParticipantActionTarget;
  permissions: ParticipantActionPermissions;
  variant?: "row" | "header";
  showViewDetails?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [credentials, setCredentials] = useState<CredentialsPayload | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [disableReason, setDisableReason] = useState("");
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((type: "success" | "error", text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => setMounted(true), []);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight ?? 200;
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
      const node = e.target as Node;
      if (triggerRef.current?.contains(node) || menuRef.current?.contains(node)) return;
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

  async function resolveEnrolmentUrl(): Promise<string | null> {
    const origin = window.location.origin;
    const res = await fetch(
      `/api/admin/enrolment-token?studyRecordId=${encodeURIComponent(target.studyRecordId)}`
    );
    const tokens = (await res.json().catch(() => [])) as {
      token?: string;
      status?: string;
    }[];
    if (!res.ok || !Array.isArray(tokens)) return null;

    const active = tokens.find((t) => t.status === "active" && t.token);
    if (active?.token) return `${origin}/enrol/${active.token}`;

    const genRes = await fetch("/api/admin/enrolment-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studyRecordId: target.studyRecordId }),
    });
    const data = (await genRes.json().catch(() => ({}))) as {
      error?: string;
      token?: string;
    };
    if (!genRes.ok || !data.token) {
      showToast("error", data.error ?? "No active enrolment link");
      return null;
    }
    return `${origin}/enrol/${data.token}`;
  }

  async function copyInviteLink() {
    setBusy(true);
    try {
      const url = await resolveEnrolmentUrl();
      if (!url) return;
      await navigator.clipboard.writeText(url);
      showToast("success", "Invite link copied");
    } catch {
      showToast("error", "Could not copy link");
    }
    setBusy(false);
  }

  async function showQr() {
    setBusy(true);
    try {
      const url = await resolveEnrolmentUrl();
      if (!url) return;
      setQrUrl(url);
      setQrOpen(true);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (
      !confirm(
        `Generate a new temporary password for ${target.name?.trim() || target.email}?`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/participants/${target.id}/reset-password`, {
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
    setBusy(false);
  }

  async function submitNotification() {
    if (!draftTitle.trim()) return;
    setNotifyError(null);
    setBusy(true);
    try {
      const payload: { title: string; message?: string; url: string; userId: string } = {
        title: draftTitle.trim(),
        url: "/",
        userId: target.id,
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
        setNotifyError(adminPushSendErrorMessage(res.status, serverMsg));
        return;
      }
      showToast("success", "Notification sent");
      setNotifyOpen(false);
      setDraftTitle("");
      setDraftMessage("");
      setNotifyError(null);
    } catch {
      setNotifyError("Failed to send notification. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitDisable() {
    const reason = disableReason.trim();
    if (!reason) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/participants/${target.id}/deactivate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showToast("error", data.error ?? "Failed to disable access");
        return;
      }
      showToast("success", "Access disabled");
      setDisableOpen(false);
      setDisableReason("");
      router.refresh();
    } catch {
      showToast("error", "Network error");
    }
    setBusy(false);
  }

  async function reEnableAccess() {
    if (
      !confirm(
        `Re-enable access for ${target.name?.trim() || target.email}?`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/participants/${target.id}/activate`, {
        method: "PATCH",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showToast("error", data.error ?? "Failed to re-enable access");
        return;
      }
      showToast("success", "Access re-enabled");
      router.refresh();
    } catch {
      showToast("error", "Network error");
    }
    setBusy(false);
  }

  const detailHref = `/dashboard/admin/participants/${encodeURIComponent(target.studyRecordId)}`;

  const items = [
    ...(showViewDetails
      ? [
          {
            key: "view",
            label: "View details",
            icon: <Eye className="h-4 w-4" />,
            onClick: () => {
              setOpen(false);
              router.push(detailHref);
            },
          },
        ]
      : []),
    ...(permissions.canManageEnrolment
      ? [
          {
            key: "copy-link",
            label: "Copy invite link",
            icon: <LinkIcon className="h-4 w-4" />,
            onClick: () => {
              setOpen(false);
              void copyInviteLink();
            },
          },
          {
            key: "qr",
            label: "Show QR",
            icon: <QrCode className="h-4 w-4" />,
            onClick: () => {
              setOpen(false);
              void showQr();
            },
          },
        ]
      : []),
    ...(permissions.canSendNotification
      ? [
          {
            key: "notify",
            label: "Send notification",
            icon: <Bell className="h-4 w-4" />,
            onClick: () => {
              setOpen(false);
              setNotifyOpen(true);
              setDraftTitle("");
              setDraftMessage("");
              setNotifyError(null);
            },
          },
        ]
      : []),
    ...(permissions.canResetPassword
      ? [
          {
            key: "reset",
            label: "Reset password",
            icon: <KeyRound className="h-4 w-4" />,
            onClick: () => {
              setOpen(false);
              void resetPassword();
            },
          },
        ]
      : []),
    ...(permissions.canUpdateParticipant
      ? target.isActive
        ? [
            {
              key: "disable",
              label: "Disable access",
              icon: <UserX className="h-4 w-4" />,
              onClick: () => {
                setOpen(false);
                setDisableReason("");
                setDisableOpen(true);
              },
            },
          ]
        : [
            {
              key: "enable",
              label: "Re-enable access",
              icon: <UserCheck className="h-4 w-4" />,
              onClick: () => {
                setOpen(false);
                void reEnableAccess();
              },
            },
          ]
      : []),
  ];

  if (items.length === 0) {
    return variant === "row" ? (
      <span className="text-xs text-slate-400">Read only</span>
    ) : null;
  }

  return (
    <>
      {toast ? (
        <div
          role="status"
          className={cn(
            "fixed bottom-6 right-6 z-[60] rounded-xl border px-4 py-2 text-sm shadow-lg",
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          )}
        >
          {toast.text}
        </div>
      ) : null}

      <div ref={triggerRef} className="inline-block text-left">
        <Button
          type="button"
          size={variant === "header" ? "default" : "sm"}
          variant="outline"
          className={cn("rounded-xl", open && "border-brand/30 bg-brand-surface")}
          disabled={busy}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
        >
          Actions
          <ChevronDown
            className={cn("ml-1.5 h-4 w-4 transition-transform", open && "rotate-180")}
          />
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
                {items.map((item) =>
                  item.key === "view" ? (
                    <Link
                      key={item.key}
                      href={detailHref}
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => setOpen(false)}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  ) : (
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
                  )
                )}
              </div>,
              document.body
            )
          : null}
      </div>

      {credentials ? (
        <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />
      ) : null}

      {notifyOpen ? (
        <NotifyModal
          target={target}
          title={draftTitle}
          message={draftMessage}
          error={notifyError}
          busy={busy}
          onTitleChange={setDraftTitle}
          onMessageChange={setDraftMessage}
          onClose={() => {
            if (busy) return;
            setNotifyOpen(false);
            setDraftTitle("");
            setDraftMessage("");
            setNotifyError(null);
          }}
          onSubmit={submitNotification}
        />
      ) : null}

      {disableOpen ? (
        <DisableAccessModal
          target={target}
          reason={disableReason}
          busy={busy}
          onReasonChange={setDisableReason}
          onClose={() => {
            if (busy) return;
            setDisableOpen(false);
            setDisableReason("");
          }}
          onSubmit={submitDisable}
        />
      ) : null}

      {qrOpen && qrUrl ? (
        <QrModal url={qrUrl} onClose={() => setQrOpen(false)} />
      ) : null}
    </>
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
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={() => copy("All", shareText)}
        >
          <Copy className="mr-1.5 h-4 w-4" />
          {copied === "All" ? "Copied" : "Copy all"}
        </Button>
        <Button type="button" className="rounded-xl" onClick={onClose}>
          Done
        </Button>
      </div>
    </ModalShell>
  );
}

function NotifyModal({
  target,
  title,
  message,
  error,
  busy,
  onTitleChange,
  onMessageChange,
  onClose,
  onSubmit,
}: {
  target: ParticipantActionTarget;
  title: string;
  message: string;
  error: string | null;
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
          {target.name?.trim() || target.email}
        </span>
      </p>
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Title
          </label>
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
        {error ? (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="rounded-xl"
          disabled={busy || !title.trim()}
          onClick={onSubmit}
        >
          {busy ? "Sending…" : "Send"}
        </Button>
      </div>
    </ModalShell>
  );
}

function DisableAccessModal({
  target,
  reason,
  busy,
  onReasonChange,
  onClose,
  onSubmit,
}: {
  target: ParticipantActionTarget;
  reason: string;
  busy: boolean;
  onReasonChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const trimmed = reason.trim();
  const remaining = DISABLE_REASON_MAX - reason.length;

  return (
    <ModalShell title="Disable access" onClose={onClose}>
      <p className="text-sm text-slate-600">
        Disable app access for{" "}
        <span className="font-medium text-slate-900">
          {target.name?.trim() || target.email}
        </span>
        . A reason is required and will be shown on the participant profile.
      </p>
      <div className="mt-4 space-y-1.5">
        <label
          htmlFor="disable-reason"
          className="text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          Reason
        </label>
        <Input
          id="disable-reason"
          value={reason}
          maxLength={DISABLE_REASON_MAX}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Brief reason for disabling access"
          disabled={busy}
          className="rounded-xl"
        />
        <p className="text-right text-xs text-slate-500">
          {remaining} characters remaining
        </p>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="rounded-xl bg-rose-600 hover:bg-rose-700"
          disabled={busy || !trimmed}
          onClick={onSubmit}
        >
          {busy ? "Disabling…" : "Disable access"}
        </Button>
      </div>
    </ModalShell>
  );
}

function QrModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <ModalShell title="Enrolment QR code" onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <QRCodeSVG value={url} size={200} />
        </div>
        <p className="break-all text-center text-xs text-slate-500">{url}</p>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={copyLink}>
          <Copy className="mr-1.5 h-4 w-4" />
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button type="button" className="rounded-xl" onClick={onClose}>
          Done
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
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 rounded-lg"
          onClick={onCopy}
        >
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
