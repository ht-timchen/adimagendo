import { POST_TVUS_RECOMMENDED_DAYS_AFTER_ULTRASOUND } from "./early-clinical-protocol";

export type ChecklistDueDisplay = {
  recommendedLabel: string | null;
};

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
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

/**
 * Participant-facing due hints. Unlock remains prerequisite-based only.
 */
export function getChecklistDueDisplay(params: {
  templateKey: string;
  completedAtByKey: Map<string, Date | null>;
}): ChecklistDueDisplay {
  const { templateKey, completedAtByKey } = params;

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

  return { recommendedLabel: null };
}
