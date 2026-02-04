import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SurveysPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const templates = await prisma.surveyTemplate.findMany({
    orderBy: { intervalMonths: "asc" },
  });
  const responses = await prisma.surveyResponse.findMany({
    where: { userId: session.user.id },
  });
  const completedIds = new Set(responses.filter((r) => r.completed).map((r) => r.templateId));

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
            const done = completedIds.has(t.id);
            return (
              <Card key={t.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{t.title}</CardTitle>
                  {done ? (
                    <span className="text-sm text-violet-600 dark:text-violet-400">
                      Completed
                    </span>
                  ) : (
                    <Link
                      href={`/dashboard/surveys/${t.id}`}
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-700"
                    >
                      Start survey
                    </Link>
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
