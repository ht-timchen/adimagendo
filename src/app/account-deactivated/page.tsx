import Link from "next/link";
import { ParticipantAuthLayout } from "@/components/auth/participant-auth-layout";
import { ParticipantAuthLogo } from "@/components/auth/participant-auth-logo";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

const SUPPORT_EMAIL = "adimagendo@adelaide.edu.au";

export default function AccountDeactivatedPage() {
  return (
    <ParticipantAuthLayout>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-0 px-6 pb-4 pt-8 text-center">
          <ParticipantAuthLogo />
          <CardDescription className="mt-4 text-sm font-medium text-[#17483F]">
            Study Buddy access disabled
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-slate-700">
            Your Study Buddy account access has been disabled. You can no longer
            use the participant app with this account.
          </p>
          <p className="text-sm text-slate-600">
            This message is about Study Buddy app access only. If you have
            questions about your place in the study, contact the study team.
          </p>
          <p className="text-sm text-slate-600">
            Need help?{" "}
            <Link
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-medium text-[#2F8F7A] hover:underline"
            >
              Contact the study team
            </Link>
          </p>
        </CardContent>
      </Card>
    </ParticipantAuthLayout>
  );
}
