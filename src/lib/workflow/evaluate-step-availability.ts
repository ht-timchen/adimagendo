import type {
  StepAvailability,
  WorkflowEvaluationContext,
} from "./types";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function unlockDate(enrollmentDate: Date, unlockOffsetDays: number): Date {
  const d = startOfDay(enrollmentDate);
  d.setDate(d.getDate() + unlockOffsetDays);
  return d;
}

/**
 * Pure evaluation from loaded workflow context (no database access).
 */
export function evaluateStepAvailability(
  checklistKey: string,
  context: WorkflowEvaluationContext
): StepAvailability {
  const step = context.templatesByKey.get(checklistKey);
  if (!step) {
    return {
      locked: true,
      available: false,
      completed: false,
      reasons: [`Checklist step "${checklistKey}" not found`],
    };
  }

  if (context.completedKeys.has(checklistKey)) {
    return {
      locked: false,
      available: false,
      completed: true,
      reasons: [],
    };
  }

  const reasons: string[] = [];
  const milestoneByKey = new Map(
    context.milestones.map((m) => [m.key, m] as const)
  );

  for (const prereqKey of step.prerequisiteKeys) {
    if (prereqKey === step.key) {
      reasons.push(`Step "${step.title}" cannot depend on itself`);
      continue;
    }
    const prereq = context.templatesByKey.get(prereqKey);
    if (!prereq) {
      reasons.push(`Missing prerequisite configuration: "${prereqKey}"`);
      continue;
    }
    if (!context.completedKeys.has(prereqKey)) {
      reasons.push(`Complete "${prereq.title}" first`);
    }
  }

  if (step.unlockOffsetDays != null) {
    const unlockAt = unlockDate(context.enrollmentDate, step.unlockOffsetDays);
    if (context.now < unlockAt) {
      reasons.push(
        `Available from ${unlockAt.toLocaleDateString()} (${step.unlockOffsetDays} days after enrollment)`
      );
    }
  }

  for (const milestoneKey of step.requiredMilestoneKeys) {
    if (context.achievedMilestoneKeys.has(milestoneKey)) continue;

    const milestone = milestoneByKey.get(milestoneKey);
    if (!milestone) {
      reasons.push(`Missing milestone configuration: "${milestoneKey}"`);
      continue;
    }

    reasons.push(`Achieve milestone "${milestone.title}" first`);
  }

  const locked = reasons.length > 0;
  return {
    locked,
    available: !locked,
    completed: false,
    reasons,
  };
}
