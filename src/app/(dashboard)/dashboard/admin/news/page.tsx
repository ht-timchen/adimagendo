import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { deleteNewsPostAction } from "../_actions";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission } from "@/lib/admin-rbac";

export default async function AdminNewsPage() {
  const session = await auth();
  const canEditPosts = hasPermission(session, "post:update");
  const posts = await prisma.newsPost.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/admin"
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to overview
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">News posts</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage study news. Only published posts appear on the participant News tab.
          </p>
        </div>
        {canEditPosts ? (
          <Link
            href="/dashboard/admin/news/new"
            className={cn(buttonVariants(), "inline-flex shrink-0 items-center gap-2 rounded-xl")}
          >
            <Plus className="h-4 w-4" />
            New post
          </Link>
        ) : null}
      </div>

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader>
          <CardTitle className="text-lg">All posts</CardTitle>
          <CardDescription>Title, last updated, publication status, and actions.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 pb-0">
          {posts.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500">
              No posts yet. Create one with &quot;New post&quot;.
            </p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="max-w-[280px] px-4 py-3">
                      <p className="truncate font-medium text-slate-900" title={post.title}>
                        {post.title}
                      </p>
                      <p className="truncate text-xs text-slate-500" title={post.slug}>
                        {post.slug}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {post.updatedAt.toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {post.published ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                          Published
                          {post.publishedAt ? (
                            <span className="ml-1 font-normal text-emerald-700">
                              · {post.publishedAt.toLocaleDateString()}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {canEditPosts ? (
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/dashboard/admin/news/${post.id}`}
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
                          >
                            <Pencil className="mr-1 inline h-3.5 w-3.5" />
                            Edit
                          </Link>
                          <form action={deleteNewsPostAction} className="inline">
                            <input type="hidden" name="id" value={post.id} />
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Read only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
