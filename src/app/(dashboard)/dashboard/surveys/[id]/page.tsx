import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SurveyForm } from "@/components/survey-form";

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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/surveys"
          className="text-sm text-violet-600 hover:underline dark:text-violet-400"
        >
          ← Back to surveys
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">{template.title}</h1>
        {template.description && (
          <p className="mt-1 text-slate-600 dark:text-slate-400">
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
