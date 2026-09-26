import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import {
  getNewsListPreview,
  getPublishedNewsPostBySlug,
} from "./participant-news";

describe("getNewsListPreview", () => {
  it("uses summary (excerpt) when present instead of content truncation", () => {
    const longContent = "C".repeat(250);
    assert.equal(
      getNewsListPreview({
        excerpt: "Short summary for the list",
        content: longContent,
      }),
      "Short summary for the list"
    );
  });

  it("does not append an ellipsis to short content without a summary", () => {
    assert.equal(
      getNewsListPreview({
        excerpt: null,
        content: "Brief update.",
      }),
      "Brief update."
    );
  });

  it("truncates long content to 200 characters with an ellipsis when no summary", () => {
    const content = "A".repeat(201);
    const preview = getNewsListPreview({ excerpt: null, content });
    assert.equal(preview.length, 201);
    assert.equal(preview.slice(0, 200), "A".repeat(200));
    assert.equal(preview.endsWith("…"), true);
  });

  it("ignores blank summary and falls back to content preview", () => {
    const content = "B".repeat(210);
    const preview = getNewsListPreview({ excerpt: "   ", content });
    assert.equal(preview, `${"B".repeat(200)}…`);
  });
});

describe("getPublishedNewsPostBySlug", () => {
  const publishedSlug = `participant-news-published-${Date.now()}`;
  const draftSlug = `participant-news-draft-${Date.now()}`;
  const createdIds: string[] = [];

  before(async () => {
    const published = await prisma.newsPost.create({
      data: {
        title: "Published participant news",
        slug: publishedSlug,
        content: "Full published body for participants to read.",
        excerpt: "Published list summary",
        published: true,
        publishedAt: new Date("2026-06-01T00:00:00.000Z"),
      },
    });
    createdIds.push(published.id);

    const draft = await prisma.newsPost.create({
      data: {
        title: "Draft participant news",
        slug: draftSlug,
        content: "Draft body must stay hidden.",
        excerpt: null,
        published: false,
        publishedAt: null,
      },
    });
    createdIds.push(draft.id);
  });

  after(async () => {
    for (const id of createdIds) {
      await prisma.newsPost.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("opens a published post successfully with full content", async () => {
    const post = await getPublishedNewsPostBySlug(publishedSlug);
    assert.ok(post);
    assert.equal(post?.title, "Published participant news");
    assert.equal(post?.content, "Full published body for participants to read.");
    assert.equal(post?.published, true);
  });

  it("does not return a draft post", async () => {
    const post = await getPublishedNewsPostBySlug(draftSlug);
    assert.equal(post, null);
  });

  it("returns null for an invalid slug (not found)", async () => {
    const post = await getPublishedNewsPostBySlug("no-such-news-slug-ever");
    assert.equal(post, null);
  });
});
