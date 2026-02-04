import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const posts = await prisma.newsPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    take: 10,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">News & updates</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Study news, recruitment info, and announcements.
        </p>
      </div>

      <div className="space-y-3">
        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-slate-600 dark:text-slate-400">
              <p>No posts yet. Check back later for updates.</p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <Card key={post.id}>
              <CardHeader>
                <CardTitle className="text-base">{post.title}</CardTitle>
                {post.publishedAt && (
                  <p className="text-xs text-slate-500">
                    {post.publishedAt.toLocaleDateString()}
                  </p>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-slate-600 dark:text-slate-400">
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
