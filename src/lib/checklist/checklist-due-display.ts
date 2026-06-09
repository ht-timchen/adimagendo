import { POST_TVUS_RECOMMENDED_DAYS_AFTER_ULTRASOUND } from "./early-clinical-protocol";
import { MISSING_ENROLLMENT_DATE_MESSAGE } from "./enrollment-date-for-timing";

export type ChecklistDueDisplay = {
  recommendedLabel: string | null;
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(base: Date, days: number): Date {
  const d = startOfDay(base);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const ENROLLMENT_DUE_TEMPLATE_KEYS = new Set([
  "qol_3m",
  "qol_6m",
  "qol_9m",
  "qol_12m",
  "qol_24m",
  "qol_36m",
]);

/**
 * Participant-facing due hints. Unlock remains prerequisite-based only.
 */
export function getChecklistDueDisplay(params: {
  templateKey: string;
  completedAtByKey: Map<string, Date | null>;
  enrollmentDate?: Date | null;
  dueOffsetDays?: number | null;
  enrollmentDateMissing?: boolean;
}): ChecklistDueDisplay {
  const {
    templateKey,
    completedAtByKey,
    enrollmentDate,
    dueOffsetDays,
    enrollmentDateMissing,
  } = params;

  if (templateKey === "pre_tvus_survey") {
    return {
      recommendedLabel:
        "Complete after booking ultrasound, before your ultrasound appointment.",
    };
  }

  if (templateKey === "post_tvus_survey") {
    const ultrasoundDoneAt = completedAtByKey.get("ultrasound_completed");
    if (ultrasoundDoneAt) {
      const recommendedDate = addDays(
        ultrasoundDoneAt,
        POST_TVUS_RECOMMENDED_DAYS_AFTER_ULTRASOUND
      );
      return {
        recommendedLabel: `Recommended by ${formatDate(recommendedDate)} (within 7 days after ultrasound completion)`,
      };
    }
    return {
      recommendedLabel:
        "Recommended within 7 days after you mark ultrasound complete.",
    };
  }

  if (
    ENROLLMENT_DUE_TEMPLATE_KEYS.has(templateKey) &&
    dueOffsetDays != null &&
    dueOffsetDays > 0
  ) {
    if (enrollmentDateMissing || !enrollmentDate) {
      return { recommendedLabel: MISSING_ENROLLMENT_DATE_MESSAGE };
    }
    const dueBy = addDays(enrollmentDate, dueOffsetDays);
    return {
      recommendedLabel: `Due by ${formatDate(dueBy)}`,
    };
  }

  return { recommendedLabel: null };
}
