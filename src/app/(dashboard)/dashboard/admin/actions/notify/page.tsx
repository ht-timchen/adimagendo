import Link from "next/link";
import { Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BroadcastForm } from "@/components/admin/broadcast-form";
import { requirePermissionOrRedirect } from "@/lib/people-admin-auth";

export default async function AdminNotifyPage() {
  await requirePermissionOrRedirect("notification:broadcast");

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Send notifications</h1>
        <p className="mt-1 text-sm text-slate-600">Broadcast an in-app notification to all active participants.</p>
      </div>

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-brand" />
            Broadcast
          </CardTitle>
          <CardDescription>
            Creates one in-app notification per active participant and sends a phone push with the title to those who have turned on push. The message itself is read in the app, under Notifications. No email is sent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BroadcastForm />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-slate-500">
        <Link href="/dashboard/admin/participants" className="text-brand hover:text-brand-hover hover:underline">
          Individual participant tools
        </Link>
        {" · "}
        <Link href="/dashboard/admin" className="text-brand hover:text-brand-hover hover:underline">
          Overview
        </Link>
      </p>
    </div>
  );
}
