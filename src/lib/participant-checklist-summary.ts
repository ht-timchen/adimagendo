import type { ChecklistStatus } from "@prisma/client";

type ChecklistItemInput = {
  status: ChecklistStatus;
  template: { title: string; sortOrder: number };
};

export function summarizeParticipantChecklist(items: ChecklistItemInput[]) {
  const sorted = [...items].sort((a, b) => a.template.sortOrder - b.template.sortOrder);
  const total = sorted.length;
  const completed = sorted.filter((i) => i.status === "COMPLETED").length;
  const current = sorted.find((i) => i.status !== "COMPLETED");

  let currentStep: string | null = null;
  if (total === 0) {
    currentStep = null;
  } else if (!current) {
    currentStep = "All complete";
  } else {
    currentStep = current.template.title;
  }

  return { completed, total, currentStep };
}
