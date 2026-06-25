import { auth } from "@/auth";
import { prisma } from "@/lib/db";
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

  const posts = await prisma.newsPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    take: 10,
  });

  return (
    <div className={participantDashboardPageClassName}>
      <div>
        <h1 className={participantDashboardPageTitleClassName}>News & updates</h1>
        <p className="text-[#17483F]">
          Study news, recruitment info, and announcements.
        </p>
      </div>

      <div className="space-y-3">
        {posts.length === 0 ? (
          <Card className={participantDashboardCardClassName}>
            <CardContent className={cn("py-8 text-center", participantDashboardMutedClassName)}>
              <p>No posts yet. Check back later for updates.</p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <Card key={post.id} className={participantDashboardCardClassName}>
              <CardHeader>
                <CardTitle className={cn("text-base", participantDashboardHeadingClassName)}>
                  {post.title}
                </CardTitle>
                {post.publishedAt && (
                  <p className={cn("text-xs", participantDashboardMutedClassName)}>
                    {post.publishedAt.toLocaleDateString()}
                  </p>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <p className={cn("text-sm", participantDashboardMutedClassName)}>
                  {post.excerpt ?? post.content.slice(0, 200)}
                  {post.content.length > 200 && "…"}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
