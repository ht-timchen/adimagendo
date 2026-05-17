import { getStepAvailability } from "./get-step-availability";

export type StepUnavailableError = {
  error: "Step unavailable";
  reasons: string[];
};

/**
 * Returns a 403 payload when the step is locked by workflow rules.
 * Returns null when completion may proceed (including already-completed steps).
 */
export async function getStepCompletionBlock(
  userId: string,
  checklistKey: string
): Promise<StepUnavailableError | null> {
  const availability = await getStepAvailability(userId, checklistKey);
  if (!availability.locked) {
    return null;
  }
  return {
    error: "Step unavailable",
    reasons: availability.reasons,
  };
}
