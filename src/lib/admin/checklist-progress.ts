import type { ChecklistStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getValidChecklistTemplateIds } from "@/lib/valid-checklist-items";

/** Display-only protocol length for admin monitoring (not DB row count). */
export const ADMIN_CHECKLIST_STEP_TOTAL = 15;

export const ADMIN_CHECKLIST_ALL_COMPLETE_LABEL = "Complete 🎉";

export type AdminChecklistProgressItem = {
  templateKey: string;
  status: ChecklistStatus;
};

export type AdminChecklistProgress = {
  completed: number;
  total: typeof ADMIN_CHECKLIST_STEP_TOTAL;
  currentStepName: string | null;
};

/**
 * 15 logical admin steps. Multi-key steps count as one when every listed key is COMPLETED.
 * Keys without a matching ParticipantChecklistItem are treated as not completed.
 */
const ADMIN_LOGICAL_CHECKLIST_STEPS: {
  displayName: string;
  templateKeys: string[];
}[] = [
  { displayName: "Enrolment Survey", templateKeys: ["qol_baseline"] },
  {
    displayName: "Book Appointments",
    templateKeys: ["book_ultrasound", "book_mri", "book_bloods"],
  },
  { displayName: "Pre-TVUS Survey", templateKeys: ["pre_tvus_survey"] },
  { displayName: "Ultrasound Completed", templateKeys: ["ultrasound_completed"] },
  { displayName: "Post-TVUS Survey", templateKeys: ["post_tvus_survey"] },
  {
    displayName: "Blood Test & MRI",
    templateKeys: ["confirm_blood_test", "confirm_mri"],
  },
  { displayName: "3 Month Survey", templateKeys: ["qol_3m"] },
  { displayName: "6 Month Survey", templateKeys: ["qol_6m"] },
  { displayName: "9 Month Survey", templateKeys: ["qol_9m"] },
  { displayName: "12 Month Survey", templateKeys: ["qol_12m"] },
  { displayName: "24 Month Survey", templateKeys: ["qol_24m"] },
  { displayName: "2.5yr Book Appointment", templateKeys: ["book_2_5y"] },
  { displayName: "3yr Ultrasound Completed", templateKeys: ["ultrasound_3y_completed"] },
  { displayName: "3yr MRI Completed", templateKeys: ["mri_3y_completed"] },
  { displayName: "36 Month Survey", templateKeys: ["qol_36m"] },
];

const BOOK_APPOINTMENT_SUB_STEPS = [
  { key: "book_ultrasound", bookLabel: "Book ultrasound", bookedLabel: "Ultrasound booked" },
  { key: "book_mri", bookLabel: "Book MRI", bookedLabel: "MRI booked" },
  { key: "book_bloods", bookLabel: "Book blood test", bookedLabel: "Blood test booked" },
] as const;

const BLOOD_MRI_SUB_STEPS = [
  { key: "confirm_blood_test", bookLabel: "Confirm blood test", bookedLabel: "Blood test completed" },
  { key: "confirm_mri", bookLabel: "Confirm MRI", bookedLabel: "MRI completed" },
] as const;

function isLogicalStepComplete(
  templateKeys: string[],
  completedKeys: Set<string>
): boolean {
  return templateKeys.every((key) => completedKeys.has(key));
}

/** Granular label while a multi-key logical step is in progress. */
function resolveMultiKeyCurrentStepName(
  subSteps: readonly { key: string; bookLabel: string; bookedLabel: string }[],
  completedKeys: Set<string>
): string {
  let lastBookedLabel: string | null = null;

  for (const sub of subSteps) {
    if (!completedKeys.has(sub.key)) {
      if (lastBookedLabel) return lastBookedLabel;
      return sub.bookLabel;
    }
    lastBookedLabel = sub.bookedLabel;
  }

  return lastBookedLabel ?? subSteps[0]?.bookLabel ?? "In progress";
}

function resolveCurrentStepName(
  step: { displayName: string; templateKeys: string[] },
  completedKeys: Set<string>
): string {
  if (
    step.templateKeys.length === BOOK_APPOINTMENT_SUB_STEPS.length &&
    step.templateKeys.every(
      (key, i) => key === BOOK_APPOINTMENT_SUB_STEPS[i]?.key
    )
  ) {
    return resolveMultiKeyCurrentStepName(BOOK_APPOINTMENT_SUB_STEPS, completedKeys);
  }

  if (
    step.templateKeys.length === BLOOD_MRI_SUB_STEPS.length &&
    step.templateKeys.every((key, i) => key === BLOOD_MRI_SUB_STEPS[i]?.key)
  ) {
    return resolveMultiKeyCurrentStepName(BLOOD_MRI_SUB_STEPS, completedKeys);
  }

  const firstIncomplete = step.templateKeys.find((key) => !completedKeys.has(key));
  return firstIncomplete ? step.displayName : step.displayName;
}

/**
 * Computes admin display progress from checklist items (template key + status).
 */
export function computeAdminChecklistProgress(
  items: AdminChecklistProgressItem[]
): AdminChecklistProgress {
  const completedKeys = new Set(
    items.filter((i) => i.status === "COMPLETED").map((i) => i.templateKey)
  );

  let completed = 0;
  let currentStepName: string | null = ADMIN_LOGICAL_CHECKLIST_STEPS[0]?.displayName ?? null;

  for (const step of ADMIN_LOGICAL_CHECKLIST_STEPS) {
    if (isLogicalStepComplete(step.templateKeys, completedKeys)) {
      completed += 1;
      continue;
    }
    currentStepName = resolveCurrentStepName(step, completedKeys);
    break;
  }

  if (completed >= ADMIN_CHECKLIST_STEP_TOTAL) {
    return {
      completed: ADMIN_CHECKLIST_STEP_TOTAL,
      total: ADMIN_CHECKLIST_STEP_TOTAL,
      currentStepName: null,
    };
  }

  return {
    completed,
    total: ADMIN_CHECKLIST_STEP_TOTAL,
    currentStepName,
  };
}

/**
 * Loads a participant's checklist items and returns admin display progress.
 */
export async function getAdminChecklistProgress(
  userId: string
): Promise<AdminChecklistProgress> {
  const validTemplateIds = await getValidChecklistTemplateIds();
  const items =
    validTemplateIds.length === 0
      ? []
      : await prisma.participantChecklistItem.findMany({
          where: {
            userId,
            templateId: { in: validTemplateIds },
          },
          select: {
            status: true,
            template: { select: { key: true } },
          },
        });

  return computeAdminChecklistProgress(
    items.map((i) => ({
      templateKey: i.template.key,
      status: i.status,
    }))
  );
}
