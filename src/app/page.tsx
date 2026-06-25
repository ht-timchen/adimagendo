import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ParticipantAuthLayout } from "@/components/auth/participant-auth-layout";
import { ParticipantAuthLogo } from "@/components/auth/participant-auth-logo";
import { participantPrimaryLinkClassName } from "@/lib/auth-ui";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <ParticipantAuthLayout>
      <div className="w-full max-w-md space-y-8 text-center">
        <ParticipantAuthLogo />
        <p className="text-sm font-medium text-slate-600">
          Participant app for the ADIMAGENDO study. Sign in to access your
          checklist, symptom diary, surveys, and more.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/login" className={`h-11 w-full px-8 sm:w-auto ${participantPrimaryLinkClassName}`}>
            Sign in
          </Link>
        </div>
        <p className="text-sm text-slate-500">
          New participants receive an enrolment link from their study coordinator.
        </p>
      </div>
    </ParticipantAuthLayout>
  );
}
