import { prisma } from "@/lib/db";

/** Template IDs that exist in ChecklistTemplate (excludes orphaned participant rows). */
export async function getValidChecklistTemplateIds(): Promise<string[]> {
  const templates = await prisma.checklistTemplate.findMany({
    select: { id: true },
  });
  return templates.map((t) => t.id);
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
