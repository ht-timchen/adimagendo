import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { requireActiveParticipantPage } from "@/lib/participant-page-access";
import { getPublishedNewsPostBySlug } from "@/lib/news/participant-news";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  participantDashboardCardClassName,
  participantDashboardHeadingClassName,
  participantDashboardMutedClassName,
  participantDashboardPageClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

export default async function NewsPostDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireActiveParticipantPage(session);

  const { slug } = await params;
  const post = await getPublishedNewsPostBySlug(slug);
  if (!post) notFound();

  return (
    <div className={participantDashboardPageClassName}>
      <Link
        href="/dashboard/news"
        className={cn(
          "inline-flex items-center gap-1 text-sm font-medium text-[#2F8F7A]",
          "underline-offset-2 hover:underline focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-[#2F8F7A]/40 focus-visible:ring-offset-2"
        )}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to News
      </Link>

      <Card className={participantDashboardCardClassName}>
        <CardHeader>
          <CardTitle
            className={cn("text-xl", participantDashboardHeadingClassName)}
          >
            {post.title}
          </CardTitle>
          {post.publishedAt ? (
            <p className={cn("text-xs", participantDashboardMutedClassName)}>
              {post.publishedAt.toLocaleDateString()}
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "whitespace-pre-wrap text-sm leading-relaxed text-[#17483F]"
            )}
          >
            {post.content}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
