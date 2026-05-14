import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrCreateProjectSettings } from "@/lib/project-settings";
import { ProjectSettingsForm } from "@/components/admin/project-settings-form";
import { Settings } from "lucide-react";

export default async function AdminSettingsPage() {
  const s = await getOrCreateProjectSettings();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href="/dashboard/admin"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          ← Back to overview
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Project settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Values are stored in the database. <code className="text-xs">NEXT_PUBLIC_*</code> environment variables are
          only used when the default row is first created.
        </p>
      </div>

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-violet-600" />
            Study configuration
          </CardTitle>
          <CardDescription>Edit fields and save. Changes apply immediately for new sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectSettingsForm key={s.updatedAt.toISOString()} initial={s} />
        </CardContent>
      </Card>
    </div>
  );
}
