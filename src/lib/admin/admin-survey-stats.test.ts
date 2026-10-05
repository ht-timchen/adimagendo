import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { assertTestDatabase } from "@/lib/test-support/assert-test-database";
import { findDuplicateSurveyTemplateKeys } from "@/lib/valid-checklist-items";
import {
  earliestActivityStart,
  loadDashboardData,
} from "@/lib/admin/admin-overview-data";

assertTestDatabase();

/**
 * Real Prisma + test.db. Covers the survey-stats migration from SurveyResponse to
 * ParticipantChecklistItem (admin/page.tsx): count unit is "SURVEY checklist step marked
 * complete in the app", not a REDCap-verified survey submission.
 *
 * loadDashboardData() is not scoped to this test's rows (it reads the whole table), so every
 * assertion on its output compares a "before fixtures" / "after fixtures" delta rather than an
 * absolute number, to stay correct next to whatever else is in the shared test database.
 */
const PREFIX = `survey-stats-${process.pid}-${Date.now()}`;
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(Date.UTC(2026, 9, 15, 12, 0, 0)); // range "7d" -> from = NOW - 7d
const IN_RANGE = new Date(NOW.getTime() - 2 * DAY);
const OUT_OF_RANGE = new Date(NOW.getTime() - 20 * DAY);

let surveyTemplateId: string;
let incompleteTemplateId: string;
const userIds: string[] = [];

async function addParticipant(name: string, isActive = true) {
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}-${name}@example.test`,
      name: `Synthetic ${name}`,
      role: "PARTICIPANT",
      isActive,
      passwordHash: "x",
    },
  });
  userIds.push(user.id);
  return user;
}

before(async () => {
  // surveyTemplateKey is left null: it is a nullable FK to SurveyTemplate.key (would need a
  // matching SurveyTemplate row to satisfy the constraint), and the migrated stats count
  // ChecklistTemplate rows directly — they never read surveyTemplateKey.
  const surveyTemplate = await prisma.checklistTemplate.create({
    data: {
      key: `${PREFIX}-survey`,
      title: "Synthetic survey step",
      type: "SURVEY",
    },
  });
  surveyTemplateId = surveyTemplate.id;

  const incompleteTemplate = await prisma.checklistTemplate.create({
    data: {
      key: `${PREFIX}-survey-2`,
      title: "Synthetic survey step (left incomplete)",
      type: "SURVEY",
    },
  });
  incompleteTemplateId = incompleteTemplate.id;
});

after(async () => {
  await prisma.participantChecklistItem.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.checklistTemplate.deleteMany({
    where: { id: { in: [surveyTemplateId, incompleteTemplateId] } },
  });
  await prisma.$disconnect();
});

describe("admin survey stats read ParticipantChecklistItem, not SurveyResponse (real database)", () => {
  it("a SURVEY checklist step marked complete in range counts, with no SurveyResponse row involved", async () => {
    const before = await loadDashboardData({ range: "7d" }, NOW);

    const alice = await addParticipant("alice");
    await prisma.participantChecklistItem.create({
      data: {
        userId: alice.id,
        templateId: surveyTemplateId,
        status: "COMPLETED",
        completedAt: IN_RANGE,
      },
    });

    const afterLoad = await loadDashboardData({ range: "7d" }, NOW);

    assert.equal(
      afterLoad.kpi.surveysCompleted - before.kpi.surveysCompleted,
      1,
      "one completed SURVEY checklist step in range"
    );
    assert.equal(
      afterLoad.kpi.engagedInPeriod - before.kpi.engagedInPeriod,
      1,
      "the participant who completed it counts as engaged"
    );
    assert.equal(
      await prisma.surveyResponse.count({ where: { userId: alice.id } }),
      0,
      "no SurveyResponse row was read or needed to produce this count"
    );
  });

  it("an incomplete (PENDING) SURVEY step is not counted", async () => {
    const before = await loadDashboardData({ range: "7d" }, NOW);

    const ben = await addParticipant("ben");
    await prisma.participantChecklistItem.create({
      data: {
        userId: ben.id,
        templateId: incompleteTemplateId,
        status: "PENDING",
      },
    });

    const afterLoad = await loadDashboardData({ range: "7d" }, NOW);

    assert.equal(afterLoad.kpi.surveysCompleted, before.kpi.surveysCompleted, "PENDING is not COMPLETED");
    assert.equal(afterLoad.kpi.engagedInPeriod, before.kpi.engagedInPeriod);
  });

  it("completed outside the selected range is excluded; completed inside it is included", async () => {
    const before = await loadDashboardData({ range: "7d" }, NOW);

    const carol = await addParticipant("carol");
    await prisma.participantChecklistItem.create({
      data: {
        userId: carol.id,
        templateId: surveyTemplateId,
        status: "COMPLETED",
        completedAt: OUT_OF_RANGE,
      },
    });

    const afterOutOfRange = await loadDashboardData({ range: "7d" }, NOW);
    assert.equal(
      afterOutOfRange.kpi.surveysCompleted,
      before.kpi.surveysCompleted,
      "a completion 20 days ago is outside the 7-day window"
    );

    const dave = await addParticipant("dave");
    await prisma.participantChecklistItem.create({
      data: {
        userId: dave.id,
        templateId: surveyTemplateId,
        status: "COMPLETED",
        completedAt: IN_RANGE,
      },
    });

    const afterInRange = await loadDashboardData({ range: "7d" }, NOW);
    assert.equal(
      afterInRange.kpi.surveysCompleted - afterOutOfRange.kpi.surveysCompleted,
      1,
      "a completion 2 days ago is inside the 7-day window"
    );
  });

  it("a COMPLETED row with no completedAt does not crash the stats and is not counted", async () => {
    const before = await loadDashboardData({ range: "7d" }, NOW);

    const erin = await addParticipant("erin");
    // Not a path the app's own writers can produce (they always set completedAt together with
    // status), but nothing in the schema forbids it, so the stats must not assume it can't happen.
    await prisma.participantChecklistItem.create({
      data: {
        userId: erin.id,
        templateId: incompleteTemplateId,
        status: "COMPLETED",
        completedAt: null,
      },
    });

    const afterLoad = await loadDashboardData({ range: "7d" }, NOW);
    assert.equal(
      afterLoad.kpi.surveysCompleted,
      before.kpi.surveysCompleted,
      "a null completedAt can't fall inside [from, to], so it is excluded, not counted"
    );
  });

  it("two different participants completing the same SURVEY checklist step both count (not merged into one)", async () => {
    const before = await loadDashboardData({ range: "7d" }, NOW);

    const frank = await addParticipant("frank");
    const grace = await addParticipant("grace");
    await prisma.participantChecklistItem.createMany({
      data: [
        { userId: frank.id, templateId: surveyTemplateId, status: "COMPLETED", completedAt: IN_RANGE },
        { userId: grace.id, templateId: surveyTemplateId, status: "COMPLETED", completedAt: IN_RANGE },
      ],
    });

    const afterLoad = await loadDashboardData({ range: "7d" }, NOW);
    assert.equal(
      afterLoad.kpi.surveysCompleted - before.kpi.surveysCompleted,
      2,
      "same templateId, two participants -> counted twice, not deduplicated by template"
    );
    assert.equal(afterLoad.kpi.engagedInPeriod - before.kpi.engagedInPeriod, 2);
  });

  it("the existing participant-scope split is preserved: surveysCompleted has no participant filter, engagedInPeriod does", async () => {
    const before = await loadDashboardData({ range: "7d" }, NOW);

    const inactiveStaffLikeUser = await addParticipant("inactive-heidi", false);
    await prisma.participantChecklistItem.create({
      data: {
        userId: inactiveStaffLikeUser.id,
        templateId: surveyTemplateId,
        status: "COMPLETED",
        completedAt: IN_RANGE,
      },
    });

    const afterLoad = await loadDashboardData({ range: "7d" }, NOW);
    assert.equal(
      afterLoad.kpi.surveysCompleted - before.kpi.surveysCompleted,
      1,
      "surveysCompleted never filtered by participant/active status before this change, and still doesn't"
    );
    assert.equal(
      afterLoad.kpi.engagedInPeriod,
      before.kpi.engagedInPeriod,
      "engagedInPeriod is scoped to active PARTICIPANT users (enrolledWhere), so an inactive user's completion is not counted here"
    );
  });

  it("the heatmap buckets the completion by completedAt, not by the row count alone", async () => {
    const before = await loadDashboardData({ range: "7d" }, NOW);
    const beforeTotal = before.heatmap.cells.reduce((sum, c) => sum + c.count, 0);

    const ivan = await addParticipant("ivan");
    await prisma.participantChecklistItem.create({
      data: {
        userId: ivan.id,
        templateId: surveyTemplateId,
        status: "COMPLETED",
        completedAt: IN_RANGE,
      },
    });

    const afterLoad = await loadDashboardData({ range: "7d" }, NOW);
    const afterTotal = afterLoad.heatmap.cells.reduce((sum, c) => sum + c.count, 0);
    assert.equal(afterTotal - beforeTotal, 1, "one in-range completion adds exactly one to the heatmap total");
  });
});

describe("earliestActivityStart reads completedAt, excludes null (real database)", () => {
  it("an app-marked-complete SURVEY step can become the earliest activity date", async () => {
    const veryEarly = new Date(Date.UTC(1990, 0, 1));
    const jack = await addParticipant("jack");
    await prisma.participantChecklistItem.create({
      data: {
        userId: jack.id,
        templateId: surveyTemplateId,
        status: "COMPLETED",
        completedAt: veryEarly,
      },
    });

    const earliest = await earliestActivityStart();
    assert.ok(earliest, "an earliest date was found");
    assert.ok(
      earliest.getTime() <= veryEarly.getTime(),
      "the 1990 completion is at or before the computed earliest date"
    );
  });

  it("a COMPLETED row with completedAt = null is not picked as (or does not corrupt) the earliest date", async () => {
    const beforeInsert = await earliestActivityStart();

    const kate = await addParticipant("kate");
    await prisma.participantChecklistItem.create({
      data: {
        userId: kate.id,
        templateId: incompleteTemplateId,
        status: "COMPLETED",
        completedAt: null,
      },
    });

    const afterInsert = await earliestActivityStart();
    assert.doesNotThrow(() => afterInsert);
    assert.deepEqual(
      afterInsert?.getTime(),
      beforeInsert?.getTime(),
      "a null completedAt row must not change (and specifically must not become) the earliest date"
    );
  });
});

describe("findDuplicateSurveyTemplateKeys (real database)", () => {
  /**
   * Scope of what this suite actually checks: `npm test` runs against test.db, which is
   * migrated but not seeded (no `prisma db seed` step runs here) — at the time this file runs,
   * ChecklistTemplate holds only rows this test file and others create and clean up themselves.
   * So this does NOT check prisma/seed.ts or any deployed environment's real SURVEY templates
   * for a duplicate surveyTemplateKey; it only proves the detection function itself works. A
   * duplicate in the real seed/migration config would need to be checked there directly (e.g. a
   * static check over prisma/seed.ts, or the same query run against that environment) — this
   * suite does not claim to cover that, and nothing here protects it.
   */
  it("detects a surveyTemplateKey shared by two SURVEY checklist templates", async () => {
    const sharedKey = `${PREFIX}-shared-survey-key`;
    // surveyTemplateKey is a real FK to SurveyTemplate.key, so a matching row is required.
    await prisma.surveyTemplate.create({
      data: { key: sharedKey, title: "Synthetic shared survey", intervalMonths: 0, questions: [] },
    });
    const dupA = await prisma.checklistTemplate.create({
      data: { key: `${PREFIX}-dup-a`, title: "Synthetic duplicate A", type: "SURVEY", surveyTemplateKey: sharedKey },
    });
    const dupB = await prisma.checklistTemplate.create({
      data: { key: `${PREFIX}-dup-b`, title: "Synthetic duplicate B", type: "SURVEY", surveyTemplateKey: sharedKey },
    });
    try {
      const duplicates = await findDuplicateSurveyTemplateKeys();
      assert.ok(duplicates.includes(sharedKey), "a key used by two SURVEY templates must be reported");
    } finally {
      await prisma.checklistTemplate.deleteMany({ where: { id: { in: [dupA.id, dupB.id] } } });
      await prisma.surveyTemplate.delete({ where: { key: sharedKey } });
    }
  });

  it("does not report a surveyTemplateKey used by only one SURVEY checklist template", async () => {
    const soloKey = `${PREFIX}-solo-survey-key`;
    await prisma.surveyTemplate.create({
      data: { key: soloKey, title: "Synthetic solo survey", intervalMonths: 0, questions: [] },
    });
    const solo = await prisma.checklistTemplate.create({
      data: { key: `${PREFIX}-solo`, title: "Synthetic solo", type: "SURVEY", surveyTemplateKey: soloKey },
    });
    try {
      const duplicates = await findDuplicateSurveyTemplateKeys();
      assert.ok(!duplicates.includes(soloKey), "a key used by exactly one template is not a duplicate");
    } finally {
      await prisma.checklistTemplate.delete({ where: { id: solo.id } });
      await prisma.surveyTemplate.delete({ where: { key: soloKey } });
    }
  });
});
