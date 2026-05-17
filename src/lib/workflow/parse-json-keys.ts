/** Parses prerequisiteKeys / requiredKeys JSON from Prisma or SQLite text into string[]. */
export function parseJsonStringKeys(value: unknown): string[] {
  if (value == null) return [];

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      return parseJsonStringKeys(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }

  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}
