import Link from "next/link";
import { prisma } from "@/lib/db";
import { lastActiveTimestamp } from "@/lib/admin-display";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createAdminPersonAction, ensurePeopleAdmin, setAdminActiveAction, updateAdminPersonAction } from "../_actions";
import { UserPlus, UserCog, Ban, CheckCircle2 } from "lucide-react";

export default async function AdminPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await ensurePeopleAdmin();
  const sp = await searchParams;
  const editId = sp.edit;

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      superAdmin: true,
      createdAt: true,
      updatedAt: true,
      dateOfBirth: true,
    },
  });

  const rows = await Promise.all(
    admins.map(async (u) => ({
      ...u,
      lastActive: await lastActiveTimestamp(u.id),
    }))
  );

  const editing = editId ? admins.find((a) => a.id === editId) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">People</h1>
        <p className="mt-1 text-sm text-slate-600">Admin accounts (super admin access).</p>
      </div>

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5 text-violet-600" />
              Add person
            </CardTitle>
            <CardDescription>Create another dashboard admin with a temporary password.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form action={createAdminPersonAction} className="grid max-w-lg gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold uppercase text-slate-500">Name</label>
              <input name="name" required className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-500">Email</label>
              <input name="email" type="email" required className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-500">Password (min 8)</label>
              <input name="password" type="password" minLength={8} required className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="rounded-xl bg-violet-600">
                Add admin
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {editing ? (
        <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
          <CardHeader>
            <CardTitle className="text-lg">Edit admin</CardTitle>
            <CardDescription>
              <Link href="/dashboard/admin/people" className="text-violet-700 hover:underline">
                Cancel
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateAdminPersonAction} className="flex max-w-md flex-col gap-3">
              <input type="hidden" name="userId" value={editing.id} />
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-slate-500">Name</label>
                <input
                  name="name"
                  required
                  defaultValue={editing.name ?? ""}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <p className="text-xs text-slate-500">Email cannot be changed here: {editing.email}</p>
              <Button type="submit" className="w-fit rounded-xl bg-violet-600">
                Save
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader>
          <CardTitle className="text-lg">Admin users</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 pb-0">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Last active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name?.trim() || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800">
                      {u.superAdmin ? "Super Admin" : "Admin"}
                      {!u.active ? " · Inactive" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {u.lastActive
                      ? u.lastActive.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
                      : "—"}
                  </td>
                  <td className="space-x-2 px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/admin/people?edit=${u.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex rounded-xl")}
                    >
                      <UserCog className="mr-1 inline h-3.5 w-3.5" />
                      Edit
                    </Link>
                    {u.active ? (
                      <form action={setAdminActiveAction} className="inline">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="active" value="false" />
                        <Button type="submit" size="sm" variant="outline" className="rounded-xl border-rose-200 text-rose-700">
                          <Ban className="mr-1 inline h-3.5 w-3.5" />
                          Deactivate
                        </Button>
                      </form>
                    ) : (
                      <form action={setAdminActiveAction} className="inline">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="active" value="true" />
                        <Button type="submit" size="sm" variant="outline" className="rounded-xl border-emerald-200 text-emerald-800">
                          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                          Reactivate
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
