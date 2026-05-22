import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Profile</h1>
        <p className="mt-1 text-sm text-slate-600">Your signed-in account.</p>
      </div>
      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
          <CardDescription>Profile editing can reuse the participant profile form pattern if needed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium text-slate-700">Name:</span> {session.user.name ?? "—"}
          </p>
          <p>
            <span className="font-medium text-slate-700">Email:</span> {session.user.email}
          </p>
          <p>
            <span className="font-medium text-slate-700">Role:</span> {session.user.role}
          </p>
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
