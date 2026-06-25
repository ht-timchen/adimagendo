export function formatParticipantProfileDate(
  value: Date | string | null | undefined
): string {
  if (value == null) return "Not available";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString(undefined, { dateStyle: "long" });
}

export function formatParticipantProfileText(
  value: string | null | undefined
): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "Not available";
}
