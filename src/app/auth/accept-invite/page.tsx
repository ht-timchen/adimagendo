import { AcceptInviteForm } from "@/components/admin/accept-invite-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token?.trim() ?? "";

  if (!token) {
    return (
      <InviteShell>
        <p className="text-center text-sm text-rose-700">
          This invite link is invalid or has expired.
        </p>
      </InviteShell>
    );
  }

  return (
    <InviteShell>
      <AcceptInviteForm token={token} />
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">ADIMAGENDO</CardTitle>
          <CardDescription>Set your password to activate your account</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
