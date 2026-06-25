import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SurveyForm } from "@/components/survey-form";
import {
  participantDashboardPageClassName,
  participantDashboardPageTitleClassName,
} from "@/lib/participant-dashboard-ui";

export default async function SurveyTakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const { id } = await params;
  const template = await prisma.surveyTemplate.findUnique({
    where: { id },
  });
  if (!template) notFound();
  const existing = await prisma.surveyResponse.findUnique({
    where: {
      userId_templateId: { userId: session.user.id, templateId: id },
    },
  });
  const questions = (template.questions as Array<{
    id: string;
    text: string;
    type: string;
    min?: number;
    max?: number;
  }>) ?? [];

  return (
    <div className={participantDashboardPageClassName}>
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/surveys"
          className="text-sm text-[#2F8F7A] hover:text-[#277866] hover:underline"
        >
          ← Back to surveys
        </Link>
      </div>
      <div>
        <h1 className={participantDashboardPageTitleClassName}>{template.title}</h1>
        {template.description && (
          <p className="mt-1 text-[#17483F]">
            {template.description}
          </p>
        )}
      </div>
      <SurveyForm
        surveyId={id}
        questions={questions}
        initialAnswers={(existing?.answers as Record<string, unknown>) ?? {}}
        completed={existing?.completed ?? false}
      />
    </div>
  );
}
