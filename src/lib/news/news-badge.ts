import { prisma } from "@/lib/db";

export const NEWS_BADGE_MAX_DISPLAY = 9;

/** Badge label: null when zero, "1"–"9", or "9+". */
export function formatNewsBadgeCount(count: number): string | null {
  if (count <= 0) return null;
  if (count > NEWS_BADGE_MAX_DISPLAY) return `${NEWS_BADGE_MAX_DISPLAY}+`;
  return String(count);
}

export function newsBadgeAriaLabel(count: number): string {
  if (count <= 0) return "News";
  if (count === 1) return "News – 1 new post";
  if (count > NEWS_BADGE_MAX_DISPLAY) return "News – 9+ new posts";
  return `News – ${count} new posts`;
}

/**
 * Count published posts newer than lastViewedAt.
 * Never-viewed (null) treats all dated published posts as new.
 */
export function countNewPublishedNewsPosts(params: {
  lastViewedAt: Date | null | undefined;
  posts: Array<{ published: boolean; publishedAt: Date | null }>;
}): number {
  const threshold = params.lastViewedAt?.getTime() ?? 0;
  return params.posts.filter(
    (post) =>
      post.published === true &&
      post.publishedAt != null &&
      post.publishedAt.getTime() > threshold
  ).length;
}

export async function getParticipantNewNewsCount(
  userId: string
): Promise<number> {
  const profile = await prisma.participantProfile.findUnique({
    where: { userId },
    select: { newsLastViewedAt: true },
  });
  if (!profile) return 0;

  const threshold = profile.newsLastViewedAt ?? new Date(0);
  return prisma.newsPost.count({
    where: {
      published: true,
      publishedAt: { gt: threshold },
    },
  });
}

/** Persist News list visit for this participant only. */
export async function markParticipantNewsViewed(
  userId: string,
  viewedAt: Date = new Date()
): Promise<void> {
  await prisma.participantProfile.updateMany({
    where: { userId },
    data: { newsLastViewedAt: viewedAt },
  });
}
