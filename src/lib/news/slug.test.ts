import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import {
  createNewsPostWithUniqueSlug,
  MAX_NEWS_SLUG_LENGTH,
  newsSlugCandidate,
  slugifyTitle,
} from "./slug";

describe("slugifyTitle", () => {
  it("lowercases and replaces unsupported characters with hyphens", () => {
    assert.equal(slugifyTitle("March Study Update!"), "march-study-update");
  });

  it("collapses repeated hyphens and trims edges", () => {
    assert.equal(slugifyTitle("  Hello---World!!  "), "hello-world");
  });

  it("falls back to post when the title has no URL-safe characters", () => {
    assert.equal(slugifyTitle("!!!"), "post");
  });

  it("limits the base slug length", () => {
    const long = "a".repeat(100);
    const slug = slugifyTitle(long);
    assert.ok(slug.length <= MAX_NEWS_SLUG_LENGTH);
    assert.equal(slug, "a".repeat(MAX_NEWS_SLUG_LENGTH));
  });
});

describe("newsSlugCandidate", () => {
  it("uses the base first, then -2, -3", () => {
    assert.equal(newsSlugCandidate("march-study-update", 0), "march-study-update");
    assert.equal(newsSlugCandidate("march-study-update", 1), "march-study-update-2");
    assert.equal(newsSlugCandidate("march-study-update", 2), "march-study-update-3");
  });

  it("keeps suffixed slugs within the max length", () => {
    const base = "a".repeat(MAX_NEWS_SLUG_LENGTH);
    const withSuffix = newsSlugCandidate(base, 1);
    assert.ok(withSuffix.length <= MAX_NEWS_SLUG_LENGTH);
    assert.ok(withSuffix.endsWith("-2"));
  });
});

describe("createNewsPostWithUniqueSlug", () => {
  const createdIds: string[] = [];
  const prefix = `slug-alloc-${Date.now()}`;

  before(async () => {
    const first = await createNewsPostWithUniqueSlug({
      title: prefix,
      content: "First body",
      published: false,
    });
    createdIds.push(first.id);
    assert.equal(first.slug, slugifyTitle(prefix));
  });

  after(async () => {
    for (const id of createdIds) {
      await prisma.newsPost.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("appends -2 when the base slug already exists", async () => {
    const second = await createNewsPostWithUniqueSlug({
      title: prefix,
      content: "Second body",
    });
    createdIds.push(second.id);
    assert.equal(second.slug, `${slugifyTitle(prefix)}-2`);
  });

  it("appends -3 for the next collision", async () => {
    const third = await createNewsPostWithUniqueSlug({
      title: prefix,
      content: "Third body",
    });
    createdIds.push(third.id);
    assert.equal(third.slug, `${slugifyTitle(prefix)}-3`);
  });

  it("does not change slug allocation rules for a distinct title", async () => {
    const otherTitle = `${prefix}-other-title`;
    const post = await createNewsPostWithUniqueSlug({
      title: otherTitle,
      content: "Other body",
    });
    createdIds.push(post.id);
    assert.equal(post.slug, slugifyTitle(otherTitle));
  });
});
