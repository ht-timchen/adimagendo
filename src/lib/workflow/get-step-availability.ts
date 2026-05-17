import { prisma } from "@/lib/db";
import { evaluateStepAvailability } from "./evaluate-step-availability";
import { parseJsonStringKeys } from "./parse-json-keys";
import type {
  StepAvailability,
  WorkflowChecklistTemplate,
  WorkflowEvaluationContext,
  WorkflowStudyMilestone,
} from "./types";

export type { StepAvailability } from "./types";
export { evaluateStepAvailability } from "./evaluate-step-availability";

export async function loadWorkflowEvaluationContext(
  userId: string,
  now: Date = new Date()
): Promise<WorkflowEvaluationContext | null> {
  const [profile, templates, checklistItems, participantMilestones, milestones] =
    await Promise.all([
      prisma.participantProfile.findUnique({
        where: { userId },
        select: { enrollmentDate: true },
      }),
      prisma.checklistTemplate.findMany({
        select: {
          key: true,
          title: true,
          sortOrder: true,
          prerequisiteKeys: true,
          requiredMilestoneKeys: true,
          unlockOffsetDays: true,
        },
      }),
      prisma.participantChecklistItem.findMany({
        where: { userId },
        select: {
          status: true,
          template: { select: { key: true } },
        },
      }),
      prisma.participantMilestone.findMany({
        where: { userId },
        select: { milestoneKey: true },
      }),
      prisma.studyMilestone.findMany({
        select: {
          key: true,
          title: true,
          requiredKeys: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

  if (!profile) return null;

  const templatesByKey = new Map<string, WorkflowChecklistTemplate>(
    templates.map((t) => [
      t.key,
      {
        key: t.key,
        title: t.title,
        sortOrder: t.sortOrder,
        prerequisiteKeys: parseJsonStringKeys(t.prerequisiteKeys),
        requiredMilestoneKeys: parseJsonStringKeys(t.requiredMilestoneKeys),
        unlockOffsetDays: t.unlockOffsetDays,
      },
    ])
  );

  const completedKeys = new Set(
    checklistItems
      .filter((item) => item.status === "COMPLETED")
      .map((item) => item.template.key)
  );

  const achievedMilestoneKeys = new Set(
    participantMilestones.map((m) => m.milestoneKey)
  );

  const workflowMilestones: WorkflowStudyMilestone[] = milestones.map((m) => ({
    key: m.key,
    title: m.title,
    sortOrder: m.sortOrder,
    requiredKeys: parseJsonStringKeys(m.requiredKeys),
  }));

  return {
    enrollmentDate: profile.enrollmentDate,
    now,
    templatesByKey,
    completedKeys,
    achievedMilestoneKeys,
    milestones: workflowMilestones,
  };
}

/**
 * Evaluates whether a checklist step is locked, available, or completed for a participant.
 */
export async function getStepAvailability(
  userId: string,
  checklistKey: string,
  options?: { now?: Date }
): Promise<StepAvailability> {
  const context = await loadWorkflowEvaluationContext(userId, options?.now);
  if (!context) {
    return {
      locked: true,
      available: false,
      completed: false,
      reasons: ["Participant profile not found"],
    };
  }

  return evaluateStepAvailability(checklistKey, context);
}
