import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { REDCAP_PRE_SCREENING_SURVEY_URL } from "@/lib/redcap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChecklistSurveySheet } from "@/components/checklist-survey-sheet";

export default async function SurveysPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const templates = await prisma.surveyTemplate.findMany({
    orderBy: { intervalMonths: "asc" },
  });
  const [responses, completedChecklistItems] = await Promise.all([
    prisma.surveyResponse.findMany({
      where: { userId: session.user.id },
      select: { templateId: true, completed: true },
    }),
    prisma.participantChecklistItem.findMany({
      where: { userId: session.user.id, status: "COMPLETED", template: { type: "SURVEY" } },
      select: { template: { select: { key: true } } },
    }),
  ]);

  const completedSurveyIds = new Set(
    responses.filter((r) => r.completed).map((r) => r.templateId)
  );
  const completedChecklistKeys = new Set(
    completedChecklistItems.map((item) => item.template.key)
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quality of life surveys</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Complete your surveys at 3, 6, 9, and 12 months.
        </p>
      </div>

      <div className="space-y-3">
        {templates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-slate-600 dark:text-slate-400">
              <p>No surveys available yet.</p>
            </CardContent>
          </Card>
        ) : (
          templates.map((t) => {
            const done = completedSurveyIds.has(t.id) || completedChecklistKeys.has(t.key);
            return (
              <Card key={t.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{t.title}</CardTitle>
                  {done ? (
                    <span className="text-sm text-violet-600 dark:text-violet-400">
                      Completed
                    </span>
                  ) : (
                    <ChecklistSurveySheet
                      surveyId={t.id}
                      surveyUrl={REDCAP_PRE_SCREENING_SURVEY_URL}
                      triggerLabel="Start survey"
                    />
                  )}
                </CardHeader>
                {t.description && (
                  <CardContent className="pt-0 text-sm text-slate-600 dark:text-slate-400">
                    {t.description}
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
