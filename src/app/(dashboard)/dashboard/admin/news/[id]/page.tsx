import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { AdminNewsForm } from "@/components/admin-news-form";
import { ArrowLeft } from "lucide-react";

export default async function AdminNewsEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;

  const { id } = await params;
  const post = await prisma.newsPost.findUnique({ where: { id } });
  if (!post) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/dashboard/admin/news"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" /> Back to news
      </Link>
      <AdminNewsForm
        mode="edit"
        initial={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          content: post.content,
          excerpt: post.excerpt,
          published: post.published,
        }}
      />
    </div>
  );
}
