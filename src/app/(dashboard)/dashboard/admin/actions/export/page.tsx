import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown } from "lucide-react";
import { SymptomDiaryExportButton } from "@/components/admin/symptom-diary-export-button";
import { requirePermissionOrRedirect } from "@/lib/people-admin-auth";

export default async function AdminExportPage() {
  await requirePermissionOrRedirect("symptom_diary:export");
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href="/dashboard/admin"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          ← Back to overview
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Export data</h1>
        <p className="mt-1 text-sm text-slate-600">
          Download study data as CSV. Symptom diary export uses{" "}
          <span className="font-mono text-xs">GET /api/admin/export/symptoms</span>.
        </p>
      </div>

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileDown className="h-5 w-5 text-brand" />
            Symptom diary
          </CardTitle>
          <CardDescription>
            One row per symptom entry: record ID, participant email, date, pain level, symptoms JSON, notes, REDCap sync
            flags.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SymptomDiaryExportButton />
        </CardContent>
      </Card>
    </div>
  );
}
