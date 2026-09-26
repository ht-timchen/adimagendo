import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import {
  countNewPublishedNewsPosts,
  formatNewsBadgeCount,
  getParticipantNewNewsCount,
  markParticipantNewsViewed,
  newsBadgeAriaLabel,
} from "./news-badge";

describe("formatNewsBadgeCount", () => {
  it("hides the badge when the count is zero", () => {
    assert.equal(formatNewsBadgeCount(0), null);
  });

  it("shows exact counts from 1 to 9", () => {
    assert.equal(formatNewsBadgeCount(1), "1");
    assert.equal(formatNewsBadgeCount(9), "9");
  });

  it("shows 9+ when the count is greater than 9", () => {
    assert.equal(formatNewsBadgeCount(10), "9+");
    assert.equal(formatNewsBadgeCount(42), "9+");
  });
});

describe("newsBadgeAriaLabel", () => {
  it("describes new post counts for assistive tech", () => {
    assert.equal(newsBadgeAriaLabel(0), "News");
    assert.equal(newsBadgeAriaLabel(2), "News – 2 new posts");
    assert.equal(newsBadgeAriaLabel(12), "News – 9+ new posts");
  });
});

describe("countNewPublishedNewsPosts", () => {
  const viewed = new Date("2026-06-01T12:00:00.000Z");

  it("counts only published posts after last visit", () => {
    const count = countNewPublishedNewsPosts({
      lastViewedAt: viewed,
      posts: [
        {
          published: true,
          publishedAt: new Date("2026-06-02T00:00:00.000Z"),
        },
        {
          published: true,
          publishedAt: new Date("2026-05-01T00:00:00.000Z"),
        },
        {
          published: false,
          publishedAt: new Date("2026-06-03T00:00:00.000Z"),
        },
      ],
    });
    assert.equal(count, 1);
  });

  it("does not count draft posts", () => {
    const count = countNewPublishedNewsPosts({
      lastViewedAt: null,
      posts: [
        {
          published: false,
          publishedAt: new Date("2026-06-03T00:00:00.000Z"),
        },
      ],
    });
    assert.equal(count, 0);
  });

  it("treats a post published after the last visit as new", () => {
    const count = countNewPublishedNewsPosts({
      lastViewedAt: viewed,
      posts: [
        {
          published: true,
          publishedAt: new Date("2026-06-01T12:00:01.000Z"),
        },
      ],
    });
    assert.equal(count, 1);
  });
});

describe("getParticipantNewNewsCount and markParticipantNewsViewed", () => {
  const userA = `news-badge-a-${Date.now()}`;
  const userB = `news-badge-b-${Date.now()}`;
  const createdPostIds: string[] = [];
  const createdUserIds = [userA, userB];

  before(async () => {
    for (const id of createdUserIds) {
      await prisma.user.upsert({
        where: { id },
        create: {
          id,
          email: `${id}@example.com`,
          role: "PARTICIPANT",
        },
        update: {},
      });
      await prisma.participantProfile.upsert({
        where: { userId: id },
        create: {
          userId: id,
          enrollmentDate: new Date("2026-01-01T00:00:00.000Z"),
          studyRecordId: `SR-${id}`,
          newsLastViewedAt: null,
        },
        update: { newsLastViewedAt: null },
      });
    }

    const published = await prisma.newsPost.create({
      data: {
        title: "Badge published",
        slug: `badge-published-${Date.now()}`,
        content: "Hello",
        published: true,
        publishedAt: new Date("2026-06-10T00:00:00.000Z"),
      },
    });
    createdPostIds.push(published.id);

    const draft = await prisma.newsPost.create({
      data: {
        title: "Badge draft",
        slug: `badge-draft-${Date.now()}`,
        content: "Hidden",
        published: false,
        publishedAt: null,
      },
    });
    createdPostIds.push(draft.id);
  });

  after(async () => {
    for (const id of createdPostIds) {
      await prisma.newsPost.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of createdUserIds) {
      await prisma.participantProfile
        .delete({ where: { userId: id } })
        .catch(() => undefined);
      await prisma.user.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("new published posts increase the badge count and drafts do not", async () => {
    const count = await getParticipantNewNewsCount(userA);
    assert.ok(count >= 1);
    const before = count;
    const extra = await prisma.newsPost.create({
      data: {
        title: "Another published",
        slug: `badge-extra-${Date.now()}`,
        content: "More",
        published: true,
        publishedAt: new Date("2026-06-11T00:00:00.000Z"),
      },
    });
    createdPostIds.push(extra.id);
    assert.equal(await getParticipantNewNewsCount(userA), before + 1);
  });

  it("opening News clears the badge and remains cleared after re-read", async () => {
    await markParticipantNewsViewed(userA, new Date());
    assert.equal(await getParticipantNewNewsCount(userA), 0);
    assert.equal(await getParticipantNewNewsCount(userA), 0);
  });

  it("after marking viewed (POST + layout refresh), returning to Dashboard keeps badge cleared", async () => {
    await prisma.participantProfile.update({
      where: { userId: userA },
      data: { newsLastViewedAt: null },
    });
    assert.ok((await getParticipantNewNewsCount(userA)) >= 1);
    // Simulates successful POST /api/participant/news-viewed then router.refresh()
    // so the shared layout re-reads the count without another News render write.
    await markParticipantNewsViewed(userA, new Date());
    const dashboardCount = await getParticipantNewNewsCount(userA);
    assert.equal(dashboardCount, 0);
    assert.equal(await getParticipantNewNewsCount(userA), 0);
  });

  it("one participant viewing News does not clear another participant badge", async () => {
    await prisma.participantProfile.update({
      where: { userId: userB },
      data: { newsLastViewedAt: null },
    });
    const countBBefore = await getParticipantNewNewsCount(userB);
    assert.ok(countBBefore >= 1);
    await markParticipantNewsViewed(userA, new Date());
    assert.equal(await getParticipantNewNewsCount(userA), 0);
    assert.equal(await getParticipantNewNewsCount(userB), countBBefore);
  });

  it("a post published after the last visit appears as new again", async () => {
    const viewedAt = new Date();
    await markParticipantNewsViewed(userA, viewedAt);
    assert.equal(await getParticipantNewNewsCount(userA), 0);
    const newer = await prisma.newsPost.create({
      data: {
        title: "After visit",
        slug: `badge-after-${Date.now()}`,
        content: "New",
        published: true,
        publishedAt: new Date(viewedAt.getTime() + 60_000),
      },
    });
    createdPostIds.push(newer.id);
    assert.equal(await getParticipantNewNewsCount(userA), 1);
  });
});
