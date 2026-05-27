"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Link as LinkIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type EnrolmentTokenRow = {
  id: string;
  token: string;
  studyRecordId: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  status: "used" | "expired" | "active";
};

type GeneratedLink = {
  token: string;
  studyRecordId: string;
  expiresAt: string;
  participantLabel: string | null;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadgeClass(status: EnrolmentTokenRow["status"]): string {
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

function statusLabel(status: EnrolmentTokenRow["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function EnrolmentClient({ initialTokens }: { initialTokens: EnrolmentTokenRow[] }) {
  const router = useRouter();
  const [studyRecordId, setStudyRecordId] = useState("");
  const [participantLabel, setParticipantLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [tokens, setTokens] = useState<EnrolmentTokenRow[]>(initialTokens);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setTokens(initialTokens);
  }, [initialTokens]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const enrolmentUrl = generated && origin ? `${origin}/enrol/${generated.token}` : "";

  const refreshTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/enrolment-token");
      if (!res.ok) return;
      const data = (await res.json()) as EnrolmentTokenRow[];
      setTokens(data);
    } catch {
      /* ignore */
    }
    router.refresh();
  }, [router]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const id = studyRecordId.trim();
    if (!id) {
      setError("REDCap Record ID is required.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/enrolment-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyRecordId: id,
          label: participantLabel.trim() || undefined,
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
        return;
      }
      setGenerated({
        token: data.token,
        studyRecordId: data.studyRecordId ?? id,
        expiresAt: data.expiresAt,
        participantLabel: participantLabel.trim() || null,
      });
      setCopied(false);
      await refreshTokens();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
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

  return (
    <>
      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <LinkIcon className="h-5 w-5 text-violet-600" />
            Generate link
          </CardTitle>
          <CardDescription>
            Creates a single-use enrolment URL for the given REDCap record ID (replaces any
            unused active link for the same record).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="flex flex-col gap-4">
            <div className="space-y-1">
              <label htmlFor="studyRecordId" className="text-xs font-semibold uppercase text-slate-500">
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
              <label htmlFor="participantLabel" className="text-xs font-semibold uppercase text-slate-500">
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
            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={busy}
              className="w-fit rounded-xl bg-violet-600 hover:bg-violet-700"
            >
              {busy ? "Generating…" : "Generate Enrolment Link"}
            </Button>
          </form>
        </CardContent>
      </Card>

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
                          statusBadgeClass(row.status)
                        )}
                      >
                        {statusLabel(row.status)}
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
            <p className="mt-1 font-mono text-sm text-slate-600">Record ID: {generated.studyRecordId}</p>

            <div className="mt-6 flex justify-center">
              {enrolmentUrl ? <QRCodeSVG value={enrolmentUrl} size={200} /> : null}
            </div>

            <p className="mt-4 break-all rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800">
              {enrolmentUrl || "…"}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                type="button"
                className="rounded-xl bg-violet-600 hover:bg-violet-700"
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
