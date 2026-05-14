import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck } from "lucide-react";

export default async function ChecklistCompletionPage() {
  const users = await prisma.user.findMany({
    where: { role: "PARTICIPANT" },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      checklist: { select: { status: true } },
    },
  });

  const rows = users.map((u) => {
    const items = u.checklist;
    const total = items.length;
    const completed = items.filter((i) => i.status === "COMPLETED").length;
    const pending = items.filter((i) => i.status === "PENDING").length;
    const overdue = items.filter((i) => i.status === "OVERDUE").length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const displayName = u.name?.trim() || u.email;
    return { id: u.id, displayName, email: u.email, total, completed, pending, overdue, pct };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.items += r.total;
      acc.completed += r.completed;
      acc.pending += r.pending;
      acc.overdue += r.overdue;
      return acc;
    },
    { items: 0, completed: 0, pending: 0, overdue: 0 }
  );
  const overallPct = totals.items > 0 ? Math.round((totals.completed / totals.items) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Checklist completion</h1>
        <p className="mt-1 text-sm text-slate-600">
          Per-participant checklist progress across all template items.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Overall completion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-slate-900">{overallPct}%</p>
            <p className="text-xs text-slate-500">
              {totals.completed} of {totals.items} items completed
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-amber-700">{totals.pending}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-rose-600">{totals.overdue}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Participants</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-slate-900">{rows.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="h-5 w-5 text-violet-600" />
            By participant
          </CardTitle>
          <CardDescription>Total items, completion breakdown, and completion rate.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 pb-0">
          {rows.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">No participants yet.</p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Participant</th>
                  <th className="px-4 py-3 text-right tabular-nums">Total</th>
                  <th className="px-4 py-3 text-right tabular-nums">Completed</th>
                  <th className="px-4 py-3 text-right tabular-nums">Pending</th>
                  <th className="px-4 py-3 text-right tabular-nums">Overdue</th>
                  <th className="px-4 py-3 text-right">Completion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{r.displayName}</p>
                      <p className="text-xs text-slate-500">{r.email}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-800">{r.total}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{r.completed}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700">{r.pending}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-rose-600">{r.overdue}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="ml-auto flex max-w-[120px] items-center justify-end gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-violet-500"
                            style={{ width: `${Math.min(100, r.pct)}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-slate-600">{r.pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-sm text-slate-500">
        <Link href="/dashboard/admin" className="text-violet-700 hover:underline">
          ← Back to overview
        </Link>
      </p>
    </div>
  );
}
