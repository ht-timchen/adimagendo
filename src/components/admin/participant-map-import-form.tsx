"use client";

import { useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ParticipantMapImportForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!file || typeof file === "string" || file.size === 0) {
      setMsg({ type: "err", text: "Choose a CSV file." });
      return;
    }
    setBusy(true);
    try {
      const up = new FormData();
      up.set("file", file);
      const res = await fetch("/api/admin/import-participant-map", {
        method: "POST",
        body: up,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        updated?: number;
        skipped?: number;
        errors?: string[];
      };
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? `Request failed (${res.status})` });
        return;
      }
      const parts = [`Updated ${data.updated ?? 0} participant(s).`, `Skipped ${data.skipped ?? 0}.`];
      if (data.errors?.length) {
        parts.push(`Notes: ${data.errors.slice(0, 5).join(" · ")}`);
      }
      setMsg({ type: "ok", text: parts.join(" ") });
      e.currentTarget.reset();
    } catch {
      setMsg({ type: "err", text: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="csv" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          CSV file
        </label>
        <Input
          id="csv"
          name="file"
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          className={cn("cursor-pointer rounded-xl border-slate-200")}
        />
        <p className="text-xs leading-relaxed text-slate-500">
          Required columns: <span className="font-mono text-slate-700">email</span> and{" "}
          <span className="font-mono text-slate-700">record_id</span> (or study_record_id). One row per participant.
        </p>
      </div>
      {msg ? (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            msg.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-800"
          )}
        >
          {msg.text}
        </p>
      ) : null}
      <Button type="submit" disabled={busy} className="rounded-xl bg-violet-600 hover:bg-violet-700">
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Importing…
          </>
        ) : (
          <>
            <FileUp className="mr-2 h-4 w-4" />
            Import mapping
          </>
        )}
      </Button>
    </form>
  );
}
