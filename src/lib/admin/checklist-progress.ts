import type { ChecklistStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getValidChecklistTemplateIds } from "@/lib/valid-checklist-items";

/** Study protocol template count (matches seeded ChecklistTemplate rows). */
export const ADMIN_CHECKLIST_STEP_TOTAL = 19;

export const ADMIN_CHECKLIST_ALL_COMPLETE_LABEL = "Complete 🎉";

export type AdminChecklistProgressItem = {
  templateKey: string;
  status: ChecklistStatus;
};

export type AdminChecklistProgress = {
  completed: number;
  total: number;
  currentStepName: string | null;
};

/**
 * Ordered logical steps for "Next: …" hints. Multi-key steps advance when every
 * listed key is COMPLETED. All 19 seed template keys appear exactly once below.
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
  {
    displayName: "2.5yr Book Appointment",
    templateKeys: ["book_ultrasound_3y", "book_mri_3y"],
  },
  { displayName: "24 Month Survey", templateKeys: ["qol_24m"] },
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

  return step.displayName;
}

function resolveNextStepName(completedKeys: Set<string>): string | null {
  for (const step of ADMIN_LOGICAL_CHECKLIST_STEPS) {
    if (!isLogicalStepComplete(step.templateKeys, completedKeys)) {
      return resolveCurrentStepName(step, completedKeys);
    }
  }
  return null;
}

/**
 * Computes admin display progress from checklist items (template key + status).
 * completed counts COMPLETED rows only; total is always ADMIN_CHECKLIST_STEP_TOTAL
 * (must stay in sync with ChecklistTemplate count in prisma/seed.ts). Templates
 * with no ParticipantChecklistItem row count as incomplete. currentStepName uses
 * ADMIN_LOGICAL_CHECKLIST_STEPS for human-readable "Next: …" hints.
 */
export function computeAdminChecklistProgress(
  items: AdminChecklistProgressItem[]
): AdminChecklistProgress {
  const completedKeys = new Set(
    items.filter((i) => i.status === "COMPLETED").map((i) => i.templateKey)
  );

  const completed = items.filter((i) => i.status === "COMPLETED").length;
  const total = ADMIN_CHECKLIST_STEP_TOTAL;

  const currentStepName =
    completed >= ADMIN_CHECKLIST_STEP_TOTAL
      ? null
      : resolveNextStepName(completedKeys);

  return {
    completed,
    total,
    currentStepName,
  };
}

/**
 * Cohort-wide checklist completion: sum of completed templates across
 * enrolled participants, divided by (participants × ADMIN_CHECKLIST_STEP_TOTAL).
 */
export function computeCohortChecklistCompletionPct(
  participantsChecklists: AdminChecklistProgressItem[][]
): number {
  const n = participantsChecklists.length;
  if (n === 0) return 0;

  let completedSteps = 0;
  for (const items of participantsChecklists) {
    completedSteps += computeAdminChecklistProgress(items).completed;
  }

  const maxSteps = n * ADMIN_CHECKLIST_STEP_TOTAL;
  return Math.round((completedSteps / maxSteps) * 100);
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
