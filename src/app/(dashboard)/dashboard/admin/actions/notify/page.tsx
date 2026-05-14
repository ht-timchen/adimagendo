import Link from "next/link";
import { Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { notifyAllParticipantsAction } from "../../_actions";

export default async function AdminNotifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Send notifications</h1>
        <p className="mt-1 text-sm text-slate-600">Broadcast an in-app notification to all active participants.</p>
      </div>

      {sp.error === "missing-title" ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">Title is required.</p>
      ) : null}

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-violet-600" />
            Broadcast
          </CardTitle>
          <CardDescription>Creates one notification per active participant.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={notifyAllParticipantsAction} className="flex flex-col gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-500">Title</label>
              <input name="title" required className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-500">Message (optional)</label>
              <textarea name="body" rows={4} className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <Button type="submit" className="w-fit rounded-xl bg-violet-600 hover:bg-violet-700">
              Send to all
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-slate-500">
        <Link href="/dashboard/admin/participants" className="text-violet-700 hover:underline">
          Individual participant tools
        </Link>
        {" · "}
        <Link href="/dashboard/admin" className="text-violet-700 hover:underline">
          Overview
        </Link>
      </p>
    </div>
  );
}
