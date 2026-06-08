import type {
  StepAvailability,
  StepAvailabilityReasonCode,
  WorkflowBookingProgress,
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

function isBookingPrerequisiteMet(
  progress: WorkflowBookingProgress | undefined
): boolean {
  return progress === "BOOKED_EXTERNALLY" || progress === "CONFIRMED";
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
      reasonCodes: [],
    };
  }

  if (context.completedKeys.has(checklistKey)) {
    return {
      locked: false,
      available: false,
      completed: true,
      reasons: [],
      reasonCodes: [],
    };
  }

  const reasons: string[] = [];
  const reasonCodes: StepAvailabilityReasonCode[] = [];
  const milestoneByKey = new Map(
    context.milestones.map((m) => [m.key, m] as const)
  );

  if (step.unlockOffsetDays != null) {
    const unlockAt = unlockDate(context.enrollmentDate, step.unlockOffsetDays);
    if (context.now < unlockAt) {
      reasons.push(
        `Available from ${unlockAt.toLocaleDateString()} (${step.unlockOffsetDays} days after enrollment)`
      );
    }
  }

  if (step.bookingPrerequisiteKey) {
    const bookingTemplate = context.templatesByKey.get(
      step.bookingPrerequisiteKey
    );
    if (!bookingTemplate) {
      reasons.push(
        `Missing booking prerequisite configuration: "${step.bookingPrerequisiteKey}"`
      );
    } else {
      const bookingProgress = context.bookingProgressByKey.get(
        step.bookingPrerequisiteKey
      );
      if (!isBookingPrerequisiteMet(bookingProgress)) {
        reasons.push(`Book ${bookingTemplate.title} first`);
        reasonCodes.push("BOOKING_PREREQUISITE_NOT_MET");
      }
    }
  }

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
    reasonCodes,
  };
}
