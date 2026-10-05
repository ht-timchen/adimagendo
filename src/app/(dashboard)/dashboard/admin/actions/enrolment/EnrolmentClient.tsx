"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Link as LinkIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  replaceLinkConfirmation,
  rowPrimaryAction,
  rowStatusPresentation,
  STATUS_COLUMN_HELP,
  STATUS_LEGEND,
  type EnrolmentRowState,
  type RowStatusTone,
} from "@/lib/enrolment/enrolment-row-state";

export type EnrolmentTokenRow = {
  id: string;
  studyRecordId: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  status: "used" | "expired" | "active";
};

export type RedcapParticipantRow = {
  id: string;
  studyRecordId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  dateOfBirth: string | null;
  participantConsentDate: string | null;
  parentConsentDate: string | null;
  enrollmentDate: string | null;
  redcapType: string | null;
  consentStatus: string | null;
  createdAt: string;
};

type GeneratedLink = {
  token: string;
  studyRecordId: string;
  expiresAt: string;
  participantLabel: string | null;
};

function formatDateTime(iso: string): string {
  return formatImportedAt(iso);
}

function formatDMY(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatImportedAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatConsentDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatImportedAt(iso);
}

function formatParentConsentDate(
  redcapType: string | null,
  iso: string | null | undefined
): string {
  if (redcapType !== "u18") return "—";
  return formatConsentDateTime(iso);
}

function tokenStatusBadgeClass(status: EnrolmentTokenRow["status"]): string {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-800";
    case "expired":
      return "bg-slate-100 text-slate-600";
    case "used":
      return "bg-violet-100 text-violet-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function tokenStatusLabel(status: EnrolmentTokenRow["status"]): string {
  if (status === "used") return "Used";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const STATUS_TONE_CLASS: Record<RowStatusTone, string> = {
  none: "text-slate-500",
  success: "bg-emerald-100 text-emerald-800",
  accent: "bg-violet-100 text-violet-800",
  danger: "bg-rose-100 text-rose-800",
  muted: "bg-slate-100 text-slate-600",
};

function redcapTypeBadge(type: string | null): { label: string; className: string } {
  if (type === "over18") {
    return { label: "over18", className: "bg-blue-100 text-blue-800" };
  }
  if (type === "u18") {
    return { label: "u18", className: "bg-purple-100 text-purple-800" };
  }
  return { label: type ?? "—", className: "bg-slate-100 text-slate-600" };
}

export function EnrolmentClient({
  initialTokens,
  redcapParticipants,
  rowStates,
}: {
  initialTokens: EnrolmentTokenRow[];
  redcapParticipants: RedcapParticipantRow[];
  rowStates: Record<string, EnrolmentRowState>;
}) {
  const router = useRouter();
  const [studyRecordId, setStudyRecordId] = useState("");
  const [participantLabel, setParticipantLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyRecordId, setBusyRecordId] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [tokens, setTokens] = useState<EnrolmentTokenRow[]>(initialTokens);
  const [participants, setParticipants] = useState(redcapParticipants);
  const [copiedRecordId, setCopiedRecordId] = useState<string | null>(null);
  const [confirmRecordId, setConfirmRecordId] = useState<string | null>(null);
  const [createdRecordId, setCreatedRecordId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [linkStatusLegendOpen, setLinkStatusLegendOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const linkStatusLegendRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    setTokens(initialTokens);
  }, [initialTokens]);

  useEffect(() => {
    setParticipants(redcapParticipants);
  }, [redcapParticipants]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!linkStatusLegendOpen) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (linkStatusLegendRef.current?.contains(target)) return;
      setLinkStatusLegendOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [linkStatusLegendOpen]);

  const enrolmentUrl = generated && origin ? `${origin}/enrol/${generated.token}` : "";

  const refreshTokens = useCallback(() => {
    router.refresh();
  }, [router]);

  async function generateLinkForRecord(
    recordId: string,
    label: string | null
  ): Promise<boolean> {
    setError(null);
    setBusyRecordId(recordId);
    try {
      const res = await fetch("/api/admin/enrolment-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyRecordId: recordId,
          label: label ?? undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        token?: string;
        studyRecordId?: string;
        expiresAt?: string;
      };
      if (!res.ok || !data.token || !data.expiresAt) {
        setError(data.error ?? "Failed to generate enrolment link.");
        return false;
      }
      setGenerated({
        token: data.token,
        studyRecordId: data.studyRecordId ?? recordId,
        expiresAt: data.expiresAt,
        participantLabel: label,
      });
      setCopied(false);
      setConfirmRecordId(null);
      setCreatedRecordId(recordId);
      refreshTokens();
      return true;
    } catch {
      setError("Network error. Please try again.");
      return false;
    } finally {
      setBusyRecordId(null);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const id = studyRecordId.trim();
    if (!id) {
      setError("REDCap Record ID is required.");
      return;
    }
    setBusy(true);
    await generateLinkForRecord(id, participantLabel.trim() || null);
    setBusy(false);
  }

  async function copyLinkForRecord(recordId: string) {
    setError(null);
    setBusyRecordId(recordId);
    try {
      const res = await fetch(`/api/admin/enrolment-token?studyRecordId=${encodeURIComponent(recordId)}`);
      const tokens = (await res.json().catch(() => [])) as { token?: string; status?: string }[];
      const active = res.ok && Array.isArray(tokens) ? tokens.find((t) => t.status === "active" && t.token) : undefined;
      if (!active?.token) {
        setError("There is no active enrolment link for this participant any more. Generate a new one.");
        router.refresh();
        return;
      }
      await navigator.clipboard.writeText(`${window.location.origin}/enrol/${active.token}`);
      setCopiedRecordId(recordId);
      window.setTimeout(() => setCopiedRecordId((v) => (v === recordId ? null : v)), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    } finally {
      setBusyRecordId(null);
    }
  }

  async function runSync() {
    setSyncMessage(null);
    setError(null);

    setSyncBusy(true);
    try {
      const res = await fetch("/api/admin/trigger-redcap-sync", {
        method: "POST",
      });
      const data = (await res.json()) as {
        error?: string;
        detail?: string;
        synced?: number;
        skipped?: number;
      };
      if (!res.ok) {
        setError(data.error ?? data.detail ?? "Sync failed.");
        return;
      }
      setSyncMessage(
        `Sync complete: ${data.synced ?? 0} synced, ${data.skipped ?? 0} skipped.`
      );
      router.refresh();
    } catch {
      setError("Network error while running sync.");
    } finally {
      setSyncBusy(false);
    }
  }

  async function copyLink() {
    if (!generated || !origin) return;
    const url = `${origin}/enrol/${generated.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  const participantRows = useMemo(() => participants, [participants]);

  return (
    <>
      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Consented Participants (from REDCap)</CardTitle>
            <CardDescription>
              Nightly sync imports consented baseline participants. Generate an enrolment link per
              row for GP letters.
            </CardDescription>
          </div>
          <Button
            type="button"
            className="shrink-0 rounded-xl"
            disabled={syncBusy}
            onClick={runSync}
          >
            {syncBusy ? "Syncing..." : "Sync from REDCap"}
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:px-6 sm:pb-6">
          {participantRows.length === 0 ? (
            <div className="px-6 pb-6 text-center">
              <p className="text-sm text-slate-600">No participants synced yet. Run the sync first.</p>
              <Button
                type="button"
                className="mt-4 rounded-xl"
                disabled={syncBusy}
                onClick={runSync}
              >
                {syncBusy ? "Syncing..." : "Sync from REDCap"}
              </Button>
            </div>
          ) : (
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">REDCap Record ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Date of Birth</th>
                  <th className="px-4 py-3">REDCap Type</th>
                  <th className="px-4 py-3">Participant Consent Date</th>
                  <th className="px-4 py-3">Parent Consent Date</th>
                  <th className="px-4 py-3">Enrolment Date</th>
                  <th className="px-4 py-3">Imported</th>
                  <th
                    ref={linkStatusLegendRef}
                    className="relative px-4 py-3"
                  >
                    <span className="inline-flex items-center gap-1">
                      Status
                      <button
                        type="button"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Status legend"
                        aria-expanded={linkStatusLegendOpen}
                        onClick={() => setLinkStatusLegendOpen((v) => !v)}
                      >
                        ⓘ
                      </button>
                    </span>
                    {linkStatusLegendOpen ? (
                      <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-normal normal-case tracking-normal text-slate-700 shadow-lg">
                        <p className="mb-2">{STATUS_COLUMN_HELP}</p>
                        <ul className="space-y-2 border-t border-slate-100 pt-2">
                          {STATUS_LEGEND.map((item) => (
                            <li key={item.label} className="flex items-start gap-2">
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                                  STATUS_TONE_CLASS[item.tone]
                                )}
                              >
                                {item.label}
                              </span>
                              <span>{item.meaning}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participantRows.map((p) => {
                  const name =
                    [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "—";
                  const rowState: EnrolmentRowState = rowStates[p.studyRecordId] ?? { kind: "no-link" };
                  const status = rowStatusPresentation(rowState);
                  const primaryAction = rowPrimaryAction(rowState);
                  const rowBusy = busyRecordId === p.studyRecordId;
                  const typeBadge = redcapTypeBadge(p.redcapType);
                  const label =
                    [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || null;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono text-slate-900">{p.studyRecordId}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{name}</td>
                      <td className="px-4 py-3 text-slate-700">{p.email ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDMY(p.dateOfBirth)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                            typeBadge.className
                          )}
                        >
                          {typeBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatConsentDateTime(p.participantConsentDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatParentConsentDate(p.redcapType, p.parentConsentDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatConsentDateTime(p.enrollmentDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatImportedAt(p.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {status.tone === "none" ? (
                          <span className={STATUS_TONE_CLASS.none}>{status.label}</span>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                              STATUS_TONE_CLASS[status.tone]
                            )}
                          >
                            {status.label}
                          </span>
                        )}
                        {rowState.kind === "link-active" ? (
                          <div className="mt-1 text-xs text-slate-500">
                            Expires {formatImportedAt(rowState.expiresAt)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {primaryAction === "view" ? (
                          <Link
                            href={`/dashboard/admin/participants/${encodeURIComponent(p.studyRecordId)}`}
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
                          >
                            View participant
                          </Link>
                        ) : primaryAction === "copy" ? (
                          <div className="flex flex-col items-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-xl"
                              disabled={rowBusy}
                              onClick={() => copyLinkForRecord(p.studyRecordId)}
                            >
                              {copiedRecordId === p.studyRecordId ? "Copied" : "Copy enrolment link"}
                            </Button>
                            <button
                              type="button"
                              className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-800 disabled:opacity-50"
                              disabled={rowBusy}
                              onClick={() => setConfirmRecordId(p.studyRecordId)}
                            >
                              Replace link
                            </button>
                            {createdRecordId === p.studyRecordId ? (
                              <span className="text-xs font-medium text-emerald-700">
                                New enrolment link created
                              </span>
                            ) : null}
                            {confirmRecordId === p.studyRecordId ? (
                              <div className="max-w-xs rounded-lg bg-amber-50 p-3 text-left">
                                <p className="text-xs text-amber-900">
                                  {replaceLinkConfirmation(label, p.studyRecordId)}
                                </p>
                                <div className="mt-2 flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => setConfirmRecordId(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="rounded-xl"
                                    disabled={rowBusy}
                                    onClick={() => generateLinkForRecord(p.studyRecordId, label)}
                                  >
                                    {rowBusy ? "Replacing…" : "Replace link"}
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            disabled={rowBusy}
                            onClick={() => generateLinkForRecord(p.studyRecordId, label)}
                          >
                            {rowBusy ? "Generating…" : "Generate enrolment link"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {syncMessage ? (
            <p className="mt-4 px-6 pb-2 text-sm text-emerald-700">{syncMessage}</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80">
        <button
          type="button"
          className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100/80"
          onClick={() => setManualOpen((v) => !v)}
        >
          {manualOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          + Manual entry
        </button>
        {manualOpen ? (
          <div className="border-t border-slate-200 px-4 pb-4">
            <Card className="mt-4 rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <LinkIcon className="h-5 w-5 text-brand" />
                  Generate link
                </CardTitle>
                <CardDescription>
                  For edge cases: enter a REDCap record ID manually (replaces any unused active
                  link for the same record).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGenerate} className="flex flex-col gap-4">
                  <div className="space-y-1">
                    <label
                      htmlFor="studyRecordId"
                      className="text-xs font-semibold uppercase text-slate-500"
                    >
                      REDCap Record ID
                    </label>
                    <Input
                      id="studyRecordId"
                      value={studyRecordId}
                      onChange={(e) => setStudyRecordId(e.target.value)}
                      placeholder="e.g. 12345"
                      required
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="participantLabel"
                      className="text-xs font-semibold uppercase text-slate-500"
                    >
                      Participant name (optional)
                    </label>
                    <Input
                      id="participantLabel"
                      value={participantLabel}
                      onChange={(e) => setParticipantLabel(e.target.value)}
                      placeholder="For display only"
                      className="rounded-xl"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={busy}
                    className="w-fit rounded-xl"
                  >
                    {busy ? "Generating…" : "Generate Enrolment Link"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader>
          <CardTitle className="text-lg">Recent tokens</CardTitle>
          <CardDescription>Last 50 enrolment links (newest first).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:px-6 sm:pb-6">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">REDCap Record ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Used At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tokens.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    No enrolment tokens yet.
                  </td>
                </tr>
              ) : (
                tokens.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-slate-900">{row.studyRecordId}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          tokenStatusBadgeClass(row.status)
                        )}
                      >
                        {tokenStatusLabel(row.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(row.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(row.expiresAt)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.usedAt ? formatDateTime(row.usedAt) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {generated ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="enrolment-link-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 id="enrolment-link-title" className="text-lg font-semibold text-slate-900">
              Enrolment Link
              {generated.participantLabel ? ` — ${generated.participantLabel}` : ""}
            </h2>
            <p className="mt-1 font-mono text-sm text-slate-600">
              Record ID: {generated.studyRecordId}
            </p>

            <div className="mt-6 flex justify-center">
              {enrolmentUrl ? <QRCodeSVG value={enrolmentUrl} size={200} /> : null}
            </div>

            <p className="mt-4 break-all rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800">
              {enrolmentUrl || "…"}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                type="button"
                className="rounded-xl"
                onClick={copyLink}
              >
                {copied ? "Copied!" : "Copy Link"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setGenerated(null);
                  setCopied(false);
                }}
              >
                Close
              </Button>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              This link expires on {formatDateTime(generated.expiresAt)}. Distribute via GP letter
              only.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
