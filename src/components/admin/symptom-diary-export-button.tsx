"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SymptomDiaryExportButton() {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/export/symptoms", { method: "GET" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert((j as { error?: string }).error ?? `Export failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const m = cd?.match(/filename="([^"]+)"/);
      const name = m?.[1] ?? "symptom-diary-export.csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={download}
      disabled={busy}
      className="rounded-xl"
    >
      {busy ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Preparing…
        </>
      ) : (
        <>
          <FileDown className="mr-2 h-4 w-4" />
          Download symptom diary CSV
        </>
      )}
    </Button>
  );
}
