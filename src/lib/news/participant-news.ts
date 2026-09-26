import { prisma } from "@/lib/db";

export const NEWS_LIST_PREVIEW_MAX_CHARS = 200;

export type NewsListPreviewInput = {
  /** Admin UI labels this "Summary"; stored as NewsPost.excerpt. */
  excerpt: string | null | undefined;
  content: string;
};

/**
 * Participant News list preview text.
 * Prefer excerpt (summary) when present; otherwise truncate content.
 */
export function getNewsListPreview(input: NewsListPreviewInput): string {
  const excerpt = input.excerpt?.trim();
  if (excerpt) return excerpt;

  const content = input.content ?? "";
  if (content.length <= NEWS_LIST_PREVIEW_MAX_CHARS) return content;
  return `${content.slice(0, NEWS_LIST_PREVIEW_MAX_CHARS)}…`;
}

/** Published participant-facing post by slug, or null if missing/draft. */
export async function getPublishedNewsPostBySlug(slug: string) {
  const normalized = slug.trim();
  if (!normalized) return null;

  return prisma.newsPost.findFirst({
    where: {
      slug: normalized,
      published: true,
    },
  });
}
