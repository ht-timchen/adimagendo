"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Post = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  published: boolean;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function AdminNewsForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: Post | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [published, setPublished] = useState(initial?.published ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode === "create" && !initial && title && !slug) {
      setSlug(slugify(title));
    }
  }, [title, mode, initial, slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/admin/news", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            slug: slug || slugify(title),
            content,
            excerpt: excerpt || undefined,
            published,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error?.title?.[0] ?? data.error ?? "Failed to create.");
          return;
        }
        router.push("/dashboard/admin/news");
        router.refresh();
      } else if (initial) {
        const res = await fetch(`/api/admin/news/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            slug: slug || slugify(title),
            content,
            excerpt: excerpt || undefined,
            published,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error?.title?.[0] ?? data.error ?? "Failed to update.");
          return;
        }
        router.push("/dashboard/admin/news");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === "create" ? "New post" : "Edit post"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. March study update"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Slug (URL-friendly, e.g. march-update)
            </label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={slugify(title) || "march-update"}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Summary (optional)</label>
            <Input
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Short preview for the list"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Full post content..."
              className="min-h-[200px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="published"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="published" className="text-sm">
              Publish (show on News tab)
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : mode === "create" ? "Create post" : "Update post"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/dashboard/admin/news")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
