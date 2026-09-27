import { POST_TVUS_RECOMMENDED_DAYS_AFTER_ULTRASOUND } from "./early-clinical-protocol";
import {
  addCivilDays,
  adelaideCivilDate,
  formatAdelaideCivilDate,
} from "@/lib/dates/adelaide-calendar";

export type ChecklistDueDisplay = {
  recommendedLabel: string | null;
};

export const PRE_TVUS_HINT_NO_DATE =
  "Complete after booking ultrasound, before your ultrasound appointment.";

/**
 * Participant-facing TVUS survey hints (Adelaide calendar dates). Follow-up items show
 * "Available from" only (see follow-up-availability.ts); they have no due date in the app.
 */
export function getChecklistDueDisplay(params: {
  templateKey: string;
  completedAtByKey: Map<string, Date | null>;
  /** Ultrasound appointment start, when booked with a date. */
  ultrasoundAppointmentAt?: Date | null;
}): ChecklistDueDisplay {
  const { templateKey, completedAtByKey, ultrasoundAppointmentAt } = params;

  if (templateKey === "pre_tvus_survey") {
    return {
      recommendedLabel: ultrasoundAppointmentAt
        ? `Complete before your ultrasound on ${formatAdelaideCivilDate(
            adelaideCivilDate(ultrasoundAppointmentAt)
          )}`
        : PRE_TVUS_HINT_NO_DATE,
    };
  }

  if (templateKey === "post_tvus_survey") {
    const ultrasoundDoneAt = completedAtByKey.get("ultrasound_completed");
    if (ultrasoundDoneAt) {
      const recommendedDate = addCivilDays(
        adelaideCivilDate(ultrasoundDoneAt),
        POST_TVUS_RECOMMENDED_DAYS_AFTER_ULTRASOUND
      );
      return {
        recommendedLabel: `Recommended by ${formatAdelaideCivilDate(recommendedDate)} (within 7 days after ultrasound completion)`,
      };
    }
    return {
      recommendedLabel:
        "Recommended within 7 days after you mark ultrasound complete.",
    };
  }

  return { recommendedLabel: null };
}
