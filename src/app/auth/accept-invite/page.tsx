import { AcceptInviteForm } from "@/components/admin/accept-invite-form";
import { AuthBrandLogo } from "@/components/auth/auth-brand-logo";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

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
        <CardHeader className="space-y-0 px-6 pb-4 pt-8 text-center">
          <AuthBrandLogo />
          <CardDescription className="mt-4 text-sm font-medium">
            Set your password to activate your account
          </CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
