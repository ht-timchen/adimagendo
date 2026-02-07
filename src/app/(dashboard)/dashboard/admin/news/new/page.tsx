import Link from "next/link";
import { AdminNewsForm } from "@/components/admin-news-form";
import { ArrowLeft } from "lucide-react";

export default function AdminNewsNewPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/dashboard/admin/news"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" /> Back to news
      </Link>
      <AdminNewsForm mode="create" />
    </div>
  );
}
