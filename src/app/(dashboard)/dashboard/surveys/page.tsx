import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { REDCAP_PRE_SCREENING_SURVEY_URL } from "@/lib/redcap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChecklistSurveySheet } from "@/components/checklist-survey-sheet";
import {
  participantDashboardCardClassName,
  participantDashboardHeadingClassName,
  participantDashboardMutedClassName,
  participantDashboardPageClassName,
  participantDashboardPageTitleClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";

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
    <div className={participantDashboardPageClassName}>
      <div>
        <h1 className={participantDashboardPageTitleClassName}>Quality of life surveys</h1>
        <p className="text-[#17483F]">
          Complete your surveys at 3, 6, 9, and 12 months.
        </p>
      </div>

      <div className="space-y-3">
        {templates.length === 0 ? (
          <Card className={participantDashboardCardClassName}>
            <CardContent className={cn("py-8 text-center", participantDashboardMutedClassName)}>
              <p>No surveys available yet.</p>
            </CardContent>
          </Card>
        ) : (
          templates.map((t) => {
            const done = completedSurveyIds.has(t.id) || completedChecklistKeys.has(t.key);
            return (
              <Card key={t.id} className={participantDashboardCardClassName}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className={cn("text-base", participantDashboardHeadingClassName)}>
                    {t.title}
                  </CardTitle>
                  {done ? (
                    <span className="text-sm text-[#2F8F7A]">
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
                  <CardContent className={cn("pt-0 text-sm", participantDashboardMutedClassName)}>
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
