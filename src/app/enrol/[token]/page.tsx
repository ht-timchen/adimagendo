import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EnrolmentForm } from "./EnrolmentForm";

const SUPPORT_EMAIL = "adimagendo@adelaide.edu.au";

function EnrolmentErrorCard({ message }: { message: string }) {
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

  return (
    <EnrolmentForm
      token={token}
      studyRecordId={enrolment.studyRecordId}
      expiresAt={enrolment.expiresAt.toISOString()}
    />
  );
}
