import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Pencil } from "lucide-react";

export default async function AdminNewsPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;

  const posts = await prisma.newsPost.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/dashboard/admin"
          className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" /> Back to overview
        </Link>
        <Link
          href="/dashboard/admin/news/new"
          className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" /> New post
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          News posts
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Create and publish news for participants. Only published posts appear on the News tab.
        </p>
      </div>

      <div className="space-y-3">
        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-slate-600 dark:text-slate-400">
              No posts yet. Create one to show on the News page.
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <Card key={post.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                <CardTitle className="text-base">{post.title}</CardTitle>
                <Link
                  href={`/dashboard/admin/news/${post.id}`}
                  className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-700 dark:text-violet-400"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </Link>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-slate-500">
                  Slug: {post.slug}
                  {post.published ? (
                    <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-green-800 dark:bg-green-900/50 dark:text-green-200">
                      Published
                    </span>
                  ) : (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      Draft
                    </span>
                  )}
                  {post.publishedAt && (
                    <span className="ml-2">
                      · {post.publishedAt.toLocaleDateString()}
                    </span>
                  )}
                </p>
                {post.excerpt && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {post.excerpt.slice(0, 120)}
                    {post.excerpt.length > 120 && "…"}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
