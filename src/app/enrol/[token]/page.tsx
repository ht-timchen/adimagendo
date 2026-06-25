import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EnrolmentForm } from "./EnrolmentForm";

const SUPPORT_EMAIL = "adimagendo@adelaide.edu.au";

function EnrolmentErrorCard({
  message,
  signInCta = false,
}: {
  message: string;
  signInCta?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight text-violet-700">
            ADIMAGENDO
          </CardTitle>
          <CardDescription>Study participant enrolment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-slate-700 dark:text-slate-300">{message}</p>
          {signInCta ? (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
            >
              Sign in →
            </Link>
          ) : null}
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Need help?{" "}
            <Link
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-medium text-violet-600 hover:underline"
            >
              Contact the study team
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function EnrolPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const enrolment = await prisma.enrolmentToken.findUnique({
    where: { token },
  });

  if (!enrolment) {
    return <EnrolmentErrorCard message="This link is invalid." />;
  }

  if (enrolment.revokedAt) {
    return (
      <EnrolmentErrorCard message="This link has been revoked. Please contact your study coordinator." />
    );
  }

  if (enrolment.usedAt) {
    return (
      <EnrolmentErrorCard message="This link has already been used. Please contact your study coordinator." />
    );
  }

  if (enrolment.expiresAt < new Date()) {
    return (
      <EnrolmentErrorCard message="This link has expired. Please contact your study coordinator to request a new one." />
    );
  }

  const sync = await prisma.redcapParticipantSync.findUnique({
    where: { studyRecordId: enrolment.studyRecordId },
    select: { email: true, enrollmentDate: true, dateOfBirth: true },
  });

  if (!sync?.enrollmentDate) {
    return (
      <EnrolmentErrorCard message="This study record is not eligible for enrolment yet. Please contact your study coordinator." />
    );
  }

  if (!sync.dateOfBirth) {
    return (
      <EnrolmentErrorCard message="Date of birth is not on file for this study record. Please contact your study coordinator." />
    );
  }

  const email = sync.email?.trim();
  if (!email) {
    return (
      <EnrolmentErrorCard message="No email is on file for this study record. Please contact your study coordinator." />
    );
  }

  const existingProfile = await prisma.participantProfile.findFirst({
    where: { studyRecordId: enrolment.studyRecordId },
    select: { id: true },
  });
  if (existingProfile) {
    return (
      <EnrolmentErrorCard
        message="An account is already linked to ADIMAGENDO App. Sign in here."
        signInCta
      />
    );
  }

  return (
    <EnrolmentForm
      token={token}
      email={email}
      expiresAt={enrolment.expiresAt.toISOString()}
    />
  );
}
