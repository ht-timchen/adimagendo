"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  Copy,
  KeyRound,
  Pencil,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PROTECTED_ADMIN_EMAIL, type PeopleRole } from "@/lib/admin-people";

const STAFF_ROLES: PeopleRole[] = ["USER", "ADMIN", "SUPER_ADMIN"];

export type PeopleRow = {
  id: string;
  email: string;
  name: string | null;
  role: PeopleRole;
  isActive: boolean;
  lastActive: string | null;
};

const inputClass =
  "rounded-xl border-slate-200 focus-visible:ring-violet-500 dark:border-slate-700";

type CredentialsPayload = {
  email: string;
  temporaryPassword: string;
  title: string;
};

type PeopleApiResponse = {
  error?: string;
  delivery?: "email" | "manual";
  temporaryPassword?: string;
  email?: string;
};

export function PeopleManagement({
  people,
  isSuperAdmin,
  currentUserId,
  emailDeliveryAvailable,
}: {
  people: PeopleRow[];
  isSuperAdmin: boolean;
  currentUserId: string;
  emailDeliveryAvailable: boolean;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; variant: "success" | "warning" } | null>(
    null
  );
  const [addOpen, setAddOpen] = useState(false);
  const [editPerson, setEditPerson] = useState<PeopleRow | null>(null);
  const [credentials, setCredentials] = useState<CredentialsPayload | null>(null);
  const [busy, setBusy] = useState(false);

  const showToast = useCallback((msg: string, variant: "success" | "warning" = "success") => {
    setToast({ message: msg, variant });
    window.setTimeout(() => setToast(null), variant === "warning" ? 8000 : 4000);
  }, []);

  async function invitePerson(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const delivery = String(fd.get("delivery") ?? (emailDeliveryAvailable ? "email" : "manual"));
    const body = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      role: isSuperAdmin ? String(fd.get("role") ?? "USER") : "USER",
      delivery: delivery === "manual" ? "manual" : "email",
    };
    try {
      const res = await fetch("/api/admin/people/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as PeopleApiResponse;
      if (!res.ok) {
        showToast(data.error ?? "Unable to add person. Please try again.", "warning");
        setBusy(false);
        return;
      }
      setAddOpen(false);
      if (data.delivery === "manual" && data.temporaryPassword && data.email) {
        setCredentials({
          email: data.email,
          temporaryPassword: data.temporaryPassword,
          title: "Share these login details",
        });
        showToast(`Account created for ${data.email}. Copy the temporary password below.`);
      } else {
        showToast(`Invite email sent to ${body.email}`);
      }
      router.refresh();
    } catch {
      showToast("Network error");
    }
    setBusy(false);
  }

  async function saveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editPerson) return;
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const body: { name: string; role?: string } = {
      name: String(fd.get("name") ?? "").trim(),
    };
    if (isSuperAdmin) {
      body.role = String(fd.get("role") ?? editPerson.role);
    }
    try {
      const res = await fetch(`/api/admin/people/${editPerson.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        showToast(data.error ?? "Failed to save");
        setBusy(false);
        return;
      }
      showToast("Person updated");
      setEditPerson(null);
      router.refresh();
    } catch {
      showToast("Network error");
    }
    setBusy(false);
  }

  async function resetPassword(person: PeopleRow) {
    const resetConfirm = emailDeliveryAvailable
      ? `Send password reset email to ${person.email}?`
      : `Generate a temporary password for ${person.email}?`;
    if (!confirm(resetConfirm)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/people/${person.id}/reset-password`, {
        method: "POST",
      });
      const data = (await res.json()) as PeopleApiResponse;
      if (!res.ok) {
        showToast(data.error ?? "Unable to reset password. Please try again.", "warning");
      } else if (data.delivery === "manual" && data.temporaryPassword) {
        setCredentials({
          email: person.email,
          temporaryPassword: data.temporaryPassword,
          title: "New temporary password",
        });
        showToast(`Temporary password generated for ${person.email}`);
      } else {
        showToast(`Password reset email sent to ${person.email}`);
      }
    } catch {
      showToast("Network error");
    }
    setBusy(false);
  }

  async function activate(person: PeopleRow) {
    if (!confirm(`Reactivate ${person.name ?? person.email}? They will be able to sign in again.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/people/${person.id}/activate`, {
        method: "PATCH",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        showToast(data.error ?? "Failed to activate");
      } else {
        showToast(`${person.email} activated`);
        router.refresh();
      }
    } catch {
      showToast("Network error");
    }
    setBusy(false);
  }

  async function deletePerson(person: PeopleRow) {
    if (
      !confirm(
        `Permanently delete ${person.name ?? person.email}? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/people/${person.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        showToast(data.error ?? "Failed to delete");
      } else {
        showToast(`${person.email} deleted`);
        router.refresh();
      }
    } catch {
      showToast("Network error");
    }
    setBusy(false);
  }

  async function deactivate(person: PeopleRow) {
    if (!confirm(`Deactivate ${person.name ?? person.email}? They will lose access immediately.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/people/${person.id}/deactivate`, {
        method: "PATCH",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        showToast(data.error ?? "Failed to deactivate");
      } else {
        showToast(`${person.email} deactivated`);
        router.refresh();
      }
    } catch {
      showToast("Network error");
    }
    setBusy(false);
  }

  function roleBadgeClass(role: PeopleRole) {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-violet-100 text-violet-900";
      case "ADMIN":
        return "bg-indigo-50 text-indigo-800";
      default:
        return "bg-slate-100 text-slate-700";
    }
  }

  return (
    <div className="space-y-6">
      {toast ? (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            toast.variant === "warning"
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          )}
        >
          {toast.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          className="rounded-xl"
          onClick={() => setAddOpen(true)}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Add person
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-md shadow-slate-200/60">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Last active</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {people.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  No people yet. Use Add person to send an invite.
                </td>
              </tr>
            ) : (
              people.map((p) => {
                const inactive = !p.isActive;
                const protectedEmail = p.email.toLowerCase() === PROTECTED_ADMIN_EMAIL;
                const isSelf = p.id === currentUserId;
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-b border-slate-100 hover:bg-slate-50/60",
                      inactive && "bg-slate-50/80 opacity-70"
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{p.name?.trim() || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{p.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          roleBadgeClass(p.role)
                        )}
                      >
                        {p.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.lastActive
                        ? new Date(p.lastActive).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          p.isActive ? "bg-emerald-50 text-emerald-800" : "bg-slate-200 text-slate-600"
                        )}
                      >
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PeopleRowActions
                        person={p}
                        busy={busy}
                        protectedEmail={protectedEmail}
                        isSelf={isSelf}
                        onEdit={() => setEditPerson(p)}
                        onResetPassword={() => resetPassword(p)}
                        onActivate={() => activate(p)}
                        onDeactivate={() => deactivate(p)}
                        onDelete={() => deletePerson(p)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {addOpen ? (
        <Modal title="Add person" onClose={() => !busy && setAddOpen(false)}>
          <form onSubmit={invitePerson} className="space-y-4">
            <Field label="Name" name="name" required />
            <Field label="Email" name="email" type="email" required />
            <RoleSelect isSuperAdmin={isSuperAdmin} defaultValue="USER" />
            <DeliveryMethodField emailDeliveryAvailable={emailDeliveryAvailable} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={busy}>
                {busy ? "Creating…" : "Add person"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {credentials ? (
        <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />
      ) : null}

      {editPerson ? (
        <Modal title="Edit person" onClose={() => !busy && setEditPerson(null)}>
          <form onSubmit={saveEdit} className="space-y-4">
            <Field label="Name" name="name" required defaultValue={editPerson.name ?? ""} />
            <p className="text-xs text-slate-500">Email: {editPerson.email}</p>
            <RoleSelect isSuperAdmin={isSuperAdmin} defaultValue={editPerson.role} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditPerson(null)}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={busy}>
                Save
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

type PeopleRowActionsProps = {
  person: PeopleRow;
  busy: boolean;
  protectedEmail: boolean;
  isSelf: boolean;
  onEdit: () => void;
  onResetPassword: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
};

const MENU_WIDTH = 240;
const MENU_GAP = 6;

function PeopleRowActions({
  person,
  busy,
  protectedEmail,
  isSelf,
  onEdit,
  onResetPassword,
  onActivate,
  onDeactivate,
  onDelete,
}: PeopleRowActionsProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard: gates portal rendering on document.body until after mount to avoid SSR errors
      setMounted(true);
    },
    []
  );

  const closeMenu = useCallback(() => {
    setOpen(false);
    setMenuPos(null);
  }, []);

  const openMenu = useCallback(() => {
    setOpen(true);
  }, []);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight ?? 220;
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
    if (!open) return;
    updateMenuPosition();
  }, [open, updateMenuPosition, protectedEmail, person.isActive, isSelf]);

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
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, closeMenu]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, closeMenu]);

  type MenuItem = {
    key: string;
    label: string;
    icon: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    hint?: string;
    destructive?: boolean;
    separatorBefore?: boolean;
  };

  const items: MenuItem[] = [
    {
      key: "edit",
      label: "Edit",
      icon: <Pencil className="h-4 w-4" />,
      onClick: () => {
        closeMenu();
        onEdit();
      },
    },
  ];

  if (protectedEmail) {
    items.push({
      key: "password-managed",
      label: "Password (database-managed)",
      icon: <KeyRound className="h-4 w-4" />,
      disabled: true,
      hint: "This account uses a seeded password and cannot receive reset emails.",
    });
  } else if (person.isActive) {
    items.push({
      key: "reset-password",
      label: "Reset password",
      icon: <KeyRound className="h-4 w-4" />,
      onClick: () => {
        closeMenu();
        onResetPassword();
      },
    });
  }

  if (!protectedEmail && !person.isActive) {
    items.push({
      key: "activate",
      label: "Activate",
      icon: <CheckCircle2 className="h-4 w-4" />,
      separatorBefore: true,
      onClick: () => {
        closeMenu();
        onActivate();
      },
    });
  }

  if (!protectedEmail && person.isActive) {
    items.push({
      key: "deactivate",
      label: "Deactivate",
      icon: <Ban className="h-4 w-4" />,
      separatorBefore: true,
      onClick: () => {
        closeMenu();
        onDeactivate();
      },
    });
  }

  if (!protectedEmail && !isSelf) {
    items.push({
      key: "delete",
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      destructive: true,
      separatorBefore: true,
      onClick: () => {
        closeMenu();
        onDelete();
      },
    });
  }

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
        onClick={() => (open ? closeMenu() : openMenu())}
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
              className="max-h-[min(70vh,320px)] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-300/40 ring-1 ring-slate-900/5"
            >
              {items.map((item) => (
            <div key={item.key}>
              {item.separatorBefore ? (
                <div className="my-1 border-t border-slate-100" role="separator" />
              ) : null}
              <button
                type="button"
                role="menuitem"
                disabled={busy || item.disabled}
                title={item.hint}
                onClick={item.onClick}
                className={cn(
                  "flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                  item.disabled
                    ? "cursor-not-allowed text-slate-400"
                    : item.destructive
                      ? "text-rose-700 hover:bg-rose-50"
                      : "text-slate-700 hover:bg-slate-50",
                  busy && !item.disabled && "opacity-60"
                )}
              >
                <span className="mt-0.5 shrink-0">{item.icon}</span>
                <span>
                  <span className="block font-medium">{item.label}</span>
                  {item.hint ? (
                    <span className="mt-0.5 block text-xs font-normal leading-snug text-slate-500">
                      {item.hint}
                    </span>
                  ) : null}
                </span>
              </button>
            </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function DeliveryMethodField({ emailDeliveryAvailable }: { emailDeliveryAvailable: boolean }) {
  const optionClass =
    "flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm hover:bg-slate-50 has-[:checked]:border-violet-300 has-[:checked]:bg-violet-50/50";

  if (!emailDeliveryAvailable) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Access</p>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Email invite delivery is not enabled. A temporary password will be shown for you to share manually
          (Gmail, Slack, in person, etc.).
        </p>
        <input type="hidden" name="delivery" value="manual" />
      </div>
    );
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        How should they get access?
      </legend>
      <label className={optionClass}>
        <input type="radio" name="delivery" value="email" defaultChecked className="mt-1" />
        <span>
          <span className="font-medium text-slate-900">Email invite link</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Sends a link to set their own password (requires SMTP in .env).
          </span>
        </span>
      </label>
      <label className={optionClass}>
        <input type="radio" name="delivery" value="manual" className="mt-1" />
        <span>
          <span className="font-medium text-slate-900">Temporary password</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Shows a one-time password here for you to share securely with the user.
          </span>
        </span>
      </label>
    </fieldset>
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

  const shareText = `ADIMAGENDO login\nEmail: ${credentials.email}\nTemporary password: ${credentials.temporaryPassword}`;

  return (
    <Modal title={credentials.title} onClose={onClose}>
      <p className="text-sm text-slate-600">
        This password is only shown once. Copy it and share it securely with the user (for example by
        phone or in person).
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
          copied={copied === "Temporary password"}
          onCopy={() => copy("Temporary password", credentials.temporaryPassword)}
        />
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
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
    </Modal>
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

function RoleSelect({
  isSuperAdmin,
  defaultValue,
}: {
  isSuperAdmin: boolean;
  defaultValue: PeopleRole;
}) {
  const selectClass =
    "flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900";

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</label>
      {isSuperAdmin ? (
        <select name="role" defaultValue={defaultValue} className={selectClass}>
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      ) : (
        <>
          <input type="hidden" name="role" value="USER" />
          <select
            name="role_display"
            defaultValue="USER"
            disabled
            aria-disabled
            className={cn(selectClass, "cursor-not-allowed bg-slate-100 text-slate-700")}
          >
            <option value="USER">USER</option>
          </select>
          <p className="text-xs text-slate-500">
            Only super admins can assign ADMIN or SUPER_ADMIN roles.
          </p>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      <Input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className={inputClass}
      />
    </div>
  );
}

function Modal({
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
