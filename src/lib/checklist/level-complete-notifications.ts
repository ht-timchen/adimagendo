export const LEVEL_COMPLETE_NOTIFICATION_TYPES = [
  "level_1_complete",
  "level_2_complete",
  "level_3_complete",
] as const;

export type LevelCompleteNotificationType =
  (typeof LEVEL_COMPLETE_NOTIFICATION_TYPES)[number];

export const LEVEL_COMPLETE_NOTIFICATION_COPY: Record<
  LevelCompleteNotificationType,
  string
> = {
  level_1_complete: "Congratulations, you've completed Level 1!",
  level_2_complete: "Congratulations, you've completed Level 2!",
  level_3_complete: "Congratulations, you've completed Level 3!",
};

export function isLevelCompleteNotificationType(
  type: string
): type is LevelCompleteNotificationType {
  return (LEVEL_COMPLETE_NOTIFICATION_TYPES as readonly string[]).includes(type);
}
