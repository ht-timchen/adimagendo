import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUp } from "lucide-react";
import { ParticipantMapImportForm } from "@/components/admin/participant-map-import-form";
import { requirePermissionOrRedirect } from "@/lib/people-admin-auth";

export default async function AdminImportPage() {
  await requirePermissionOrRedirect("import:manage");
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href="/dashboard/admin"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          ← Back to overview
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Import participant mapping</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload a CSV to link each participant email to an external record ID (e.g. REDCap).
        </p>
      </div>

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileUp className="h-5 w-5 text-brand" />
            CSV upload
          </CardTitle>
          <CardDescription>
            Uses the secured API route <span className="font-mono text-xs">POST /api/admin/import-participant-map</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ParticipantMapImportForm />
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-slate-100 bg-slate-50/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-slate-900">Example CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800">
{`email,record_id
participant@example.com,12345
another@example.com,12346`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
