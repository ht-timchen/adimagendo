export const PUSH_WINDOW_MS = 60 * 60 * 1000;

export type ReminderStage = 1 | 2 | 3;

export type ReminderInstants = {
  reminder1At: Date;
  reminder2At: Date;
  reminder3At: Date;
  cycleEndAt: Date;
};

export type ReminderCycleView = ReminderInstants & {
  status: "pending" | "completed" | "expired_missed";
  dismissedAt: Date | null;
};

export function isWithinPushWindow(dueAt: Date, now: Date): boolean {
  const at = now.getTime();
  return at >= dueAt.getTime() && at < dueAt.getTime() + PUSH_WINDOW_MS;
}

export function deriveStage(
  cycle: ReminderInstants,
  now: Date
): ReminderStage | null {
  if (now < cycle.reminder1At || now >= cycle.cycleEndAt) return null;
  if (now < cycle.reminder2At) return 1;
  if (now < cycle.reminder3At) return 2;
  return 3;
}

export function stageStart(cycle: ReminderInstants, stage: ReminderStage): Date {
  if (stage === 1) return cycle.reminder1At;
  if (stage === 2) return cycle.reminder2At;
  return cycle.reminder3At;
}

export function dueAtForStage(cycle: ReminderInstants, stage: ReminderStage): Date {
  return stageStart(cycle, stage);
}

export function isBannerVisible(cycle: ReminderCycleView, now: Date): boolean {
  if (cycle.status !== "pending") return false;
  const stage = deriveStage(cycle, now);
  if (stage == null) return false;
  if (cycle.dismissedAt && cycle.dismissedAt >= stageStart(cycle, stage)) {
    return false;
  }
  return true;
}

export type DismissAction = "reject" | "hide_stage" | "expire";

export function dismissAction(cycle: ReminderCycleView, now: Date): DismissAction {
  if (!isBannerVisible(cycle, now)) return "reject";
  return deriveStage(cycle, now) === 3 ? "expire" : "hide_stage";
}

export function mayCreateCycle(input: {
  now: Date;
  reminder1At: Date;
  registeredAt: Date;
  isActive: boolean;
}): boolean {
  if (!input.isActive) return false;
  if (input.registeredAt > input.reminder1At) return false;
  return isWithinPushWindow(input.reminder1At, input.now);
}
