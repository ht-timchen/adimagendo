import { prisma } from "@/lib/db";

/** Template IDs that exist in ChecklistTemplate (excludes orphaned participant rows). */
export async function getValidChecklistTemplateIds(): Promise<string[]> {
  const templates = await prisma.checklistTemplate.findMany({
    select: { id: true },
  });
  return templates.map((t) => t.id);
}

/**
 * ChecklistTemplate ids for SURVEY-type steps: the questionnaire steps a participant marks
 * complete inside the app (Checklist's "Complete survey" button). This is the count unit for
 * admin survey stats — it is NOT a REDCap-verified submission, just the app's own completion
 * flag (see ParticipantChecklistItem.completedAt).
 */
export async function getSurveyChecklistTemplateIds(): Promise<string[]> {
  const templates = await prisma.checklistTemplate.findMany({
    where: { type: "SURVEY" },
    select: { id: true },
  });
  return templates.map((t) => t.id);
}

/**
 * SurveyTemplate.key values referenced by more than one SURVEY-type ChecklistTemplate row.
 *
 * Admin survey stats count ChecklistTemplate rows directly (getSurveyChecklistTemplateIds),
 * not SurveyTemplate rows, so this duplication would not double-count a single questionnaire —
 * two checklist steps pointing at the same key are two distinct completion events.
 *
 * This function's own detection logic is covered by a real-database test
 * (admin-survey-stats.test.ts), but that test runs against test.db, which is not seeded, so it
 * cannot and does not claim to guard prisma/seed.ts or any deployed environment's real data.
 * As a one-time, manual finding (checked against staging on 2026-10-05, not re-verified since,
 * and not re-checked by anything automated): staging had 9 SURVEY-type ChecklistTemplate rows
 * with 9 distinct surveyTemplateKey values. If this needs checking again, run this function
 * against that environment directly, or add a static check over prisma/seed.ts.
 */
export async function findDuplicateSurveyTemplateKeys(): Promise<string[]> {
  const templates = await prisma.checklistTemplate.findMany({
    where: { type: "SURVEY" },
    select: { surveyTemplateKey: true },
  });
  const counts = new Map<string, number>();
  for (const t of templates) {
    if (!t.surveyTemplateKey) continue;
    counts.set(t.surveyTemplateKey, (counts.get(t.surveyTemplateKey) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
}

/** Removes participant checklist rows pointing at deleted templates. */
export async function deleteOrphanedParticipantChecklistItems(): Promise<number> {
  const validIds = await getValidChecklistTemplateIds();
  if (validIds.length === 0) {
    const { count } = await prisma.participantChecklistItem.deleteMany();
    return count;
  }
  const { count } = await prisma.participantChecklistItem.deleteMany({
    where: { templateId: { notIn: validIds } },
  });
  return count;
}
