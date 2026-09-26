import { prisma } from "@/lib/db";

const MAX_SLUG_ALLOCATION_ATTEMPTS = 50;
/** Max length for the stored slug (base + numeric suffix). */
export const MAX_NEWS_SLUG_LENGTH = 72;

export function isPrismaUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

/**
 * URL-safe slug base from a title: lowercase, hyphens for separators,
 * no leading/trailing/repeated hyphens. Falls back to "post" if empty.
 */
export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_NEWS_SLUG_LENGTH)
    .replace(/-+$/g, "");
  return slug || "post";
}

/** First collision uses `-2`, then `-3`, … (base itself is attempt 1). */
export function newsSlugCandidate(base: string, attemptIndex: number): string {
  if (attemptIndex <= 0) {
    return base.slice(0, MAX_NEWS_SLUG_LENGTH).replace(/-+$/g, "") || "post";
  }
  const suffix = `-${attemptIndex + 1}`;
  const room = Math.max(1, MAX_NEWS_SLUG_LENGTH - suffix.length);
  const truncated =
    base.slice(0, room).replace(/-+$/g, "") || "post";
  return `${truncated}${suffix}`;
}

export type CreateNewsPostInput = {
  title: string;
  content: string;
  excerpt?: string | null;
  published?: boolean;
};

/**
 * Creates a NewsPost with a server-generated unique slug.
 * Retries on unique-constraint conflicts (concurrent creates).
 */
export async function createNewsPostWithUniqueSlug(input: CreateNewsPostInput) {
  const title = input.title.trim();
  const content = input.content;
  const excerpt =
    typeof input.excerpt === "string" && input.excerpt.trim()
      ? input.excerpt.trim()
      : null;
  const published = input.published ?? false;
  const base = slugifyTitle(title);

  for (let attempt = 0; attempt < MAX_SLUG_ALLOCATION_ATTEMPTS; attempt += 1) {
    const slug = newsSlugCandidate(base, attempt);
    try {
      return await prisma.newsPost.create({
        data: {
          title,
          slug,
          content,
          excerpt,
          published,
          publishedAt: published ? new Date() : null,
        },
      });
    } catch (error) {
      if (!isPrismaUniqueConflict(error)) throw error;
    }
  }

  throw new Error("Unable to allocate a unique news slug");
}
