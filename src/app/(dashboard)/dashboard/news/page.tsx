import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireActiveParticipantPage } from "@/lib/participant-page-access";
import { getNewsListPreview } from "@/lib/news/participant-news";
import { MarkNewsViewedOnVisit } from "@/components/mark-news-viewed-on-visit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  participantDashboardCardClassName,
  participantDashboardHeadingClassName,
  participantDashboardMutedClassName,
  participantDashboardPageClassName,
  participantDashboardPageTitleClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";

export default async function NewsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireActiveParticipantPage(session);

  const posts = await prisma.newsPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    take: 10,
  });

  return (
    <div className={participantDashboardPageClassName}>
      <MarkNewsViewedOnVisit />
      <div>
        <h1 className={participantDashboardPageTitleClassName}>News & updates</h1>
        <p className="text-[#17483F]">
          Study news, recruitment info, and announcements.
        </p>
      </div>

      <div className="space-y-3">
        {posts.length === 0 ? (
          <Card className={participantDashboardCardClassName}>
            <CardContent
              className={cn("py-8 text-center", participantDashboardMutedClassName)}
            >
              <p>No posts yet. Check back later for updates.</p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => {
            const preview = getNewsListPreview({
              excerpt: post.excerpt,
              content: post.content,
            });
            return (
              <Link
                key={post.id}
                href={`/dashboard/news/${post.slug}`}
                className={cn(
                  "block rounded-xl focus-visible:outline-none",
                  "focus-visible:ring-2 focus-visible:ring-[#2F8F7A]/45 focus-visible:ring-offset-2",
                  "hover:opacity-95"
                )}
                aria-label={`Open news post: ${post.title}`}
              >
                <Card
                  className={cn(
                    participantDashboardCardClassName,
                    "transition-shadow hover:shadow-md"
                  )}
                >
                  <CardHeader>
                    <CardTitle
                      className={cn(
                        "text-base",
                        participantDashboardHeadingClassName
                      )}
                    >
                      {post.title}
                    </CardTitle>
                    {post.publishedAt ? (
                      <p
                        className={cn(
                          "text-xs",
                          participantDashboardMutedClassName
                        )}
                      >
                        {post.publishedAt.toLocaleDateString()}
                      </p>
                    ) : null}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p
                      className={cn(
                        "text-sm",
                        participantDashboardMutedClassName
                      )}
                    >
                      {preview}
                    </p>
                    <p
                      className={cn(
                        "mt-2 text-xs font-medium text-[#2F8F7A]"
                      )}
                    >
                      Read full post
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
