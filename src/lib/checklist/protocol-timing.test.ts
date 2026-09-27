import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { validateProtocol } from "../../../prisma/validate-protocol";
import { ADMIN_CHECKLIST_STEP_TOTAL } from "@/lib/admin/checklist-progress";
import {
  getLevel1DueDays,
  LEVEL_1_REQUIRED_TEMPLATE_KEYS,
} from "./early-clinical-protocol";
import {
  getFollowUpOverdueThreshold,
  getFollowUpUnlock,
} from "./follow-up-availability";
import {
  LEVEL_2_REQUIRED_TEMPLATE_KEYS,
  LEVEL_3_REQUIRED_TEMPLATE_KEYS,
} from "./level2-follow-up";
import {
  BASELINE_DUE_DAYS,
  FOLLOW_UP_GRACE_DAYS,
  FOLLOW_UP_TEMPLATE_KEYS,
  FOLLOW_UP_UNLOCK_MONTHS,
  LEVEL_1_FOLLOW_UP_DUE_DAYS,
  SURVEY_WINDOW_DAYS,
  THREE_YEAR_IMAGING_TEMPLATE_KEYS,
} from "./protocol-timing";
import { addCivilDays } from "@/lib/dates/adelaide-calendar";

const REPO_ROOT = process.cwd();
const MIGRATION_SQL = readFileSync(
  path.join(
    REPO_ROOT,
    "prisma/migrations/20260927120000_followup_calendar_month_timing/migration.sql"
  ),
  "utf8"
);
const SEED_SOURCE = readFileSync(path.join(REPO_ROOT, "prisma/seed.ts"), "utf8");

/** Text of the CHECKLIST_TEMPLATES entry for one key in prisma/seed.ts. */
function seedTemplateBlock(key: string): string {
  const listStart = SEED_SOURCE.indexOf("const CHECKLIST_TEMPLATES");
  assert.ok(listStart >= 0, "CHECKLIST_TEMPLATES not found in seed");
  const start = SEED_SOURCE.indexOf(`key: "${key}",\n    title:`, listStart);
  assert.ok(start >= 0, `seed template "${key}" not found`);
  const end = SEED_SOURCE.indexOf("\n  },", start);
  return SEED_SOURCE.slice(start, end);
}

describe("protocol timing constants", () => {
  it("defines the approved month offsets", () => {
    assert.deepEqual(FOLLOW_UP_UNLOCK_MONTHS, {
      qol_3m: 3,
      qol_6m: 6,
      qol_9m: 9,
      qol_12m: 12,
      qol_24m: 24,
      book_ultrasound_3y: 30,
      book_mri_3y: 30,
      qol_36m: 36,
      ultrasound_3y_completed: 36,
      mri_3y_completed: 36,
    });
    assert.equal(FOLLOW_UP_GRACE_DAYS, 30);
    assert.equal(SURVEY_WINDOW_DAYS, 30);
    assert.equal(LEVEL_1_FOLLOW_UP_DUE_DAYS, 56);
    assert.equal(BASELINE_DUE_DAYS, 7);
  });

  it("baseline is due at 7 days, other Level 1 items at 56, other keys have no due days", () => {
    assert.equal(getLevel1DueDays("qol_baseline"), 7);
    for (const key of LEVEL_1_REQUIRED_TEMPLATE_KEYS.filter((k) => k !== "qol_baseline")) {
      assert.equal(getLevel1DueDays(key), 56, key);
    }
    for (const key of FOLLOW_UP_TEMPLATE_KEYS) {
      assert.equal(getLevel1DueDays(key), null, key);
    }
  });

  it("keeps Level definitions and the admin total unchanged", () => {
    assert.equal(LEVEL_1_REQUIRED_TEMPLATE_KEYS.length, 9);
    assert.deepEqual([...LEVEL_2_REQUIRED_TEMPLATE_KEYS], [
      "qol_3m",
      "qol_6m",
      "qol_9m",
      "qol_12m",
    ]);
    assert.deepEqual([...LEVEL_3_REQUIRED_TEMPLATE_KEYS], [
      "book_ultrasound_3y",
      "book_mri_3y",
      "qol_24m",
      "ultrasound_3y_completed",
      "mri_3y_completed",
      "qol_36m",
    ]);
    for (const key of THREE_YEAR_IMAGING_TEMPLATE_KEYS) {
      assert.ok((LEVEL_3_REQUIRED_TEMPLATE_KEYS as readonly string[]).includes(key), key);
    }
    assert.equal(ADMIN_CHECKLIST_STEP_TOTAL, 19);
  });
});

describe("follow-up unlock and overdue dates", () => {
  const enrollment = new Date("2026-01-01T12:00:00Z");

  it("computes unlock dates as Adelaide calendar dates", () => {
    const unlock = getFollowUpUnlock("qol_6m", enrollment);
    assert.deepEqual(unlock?.unlockDate, { year: 2026, month: 7, day: 1 });
    assert.equal(unlock?.label, "1 Jul 2026");
    assert.equal(unlock?.unlocksAt.toISOString(), "2026-06-30T14:30:00.000Z");
    assert.equal(getFollowUpUnlock("qol_baseline", enrollment), null);
  });

  it("puts the overdue threshold at unlock + grace days", () => {
    assert.deepEqual(
      getFollowUpOverdueThreshold("qol_3m", enrollment),
      addCivilDays({ year: 2026, month: 4, day: 1 }, FOLLOW_UP_GRACE_DAYS)
    );
  });

  it("has no overdue threshold for 3-year imaging items", () => {
    for (const key of THREE_YEAR_IMAGING_TEMPLATE_KEYS) {
      assert.equal(getFollowUpOverdueThreshold(key, enrollment), null, key);
    }
    assert.notEqual(getFollowUpOverdueThreshold("qol_36m", enrollment), null);
  });
});

describe("follow-up timing migration and seed", () => {
  it("migration sets qol_3m prerequisites to []", () => {
    assert.match(
      MIGRATION_SQL,
      /SET "prerequisiteKeys" = '\[\]'\s+WHERE "key" = 'qol_3m';/
    );
  });

  it("migration zeroes unlockOffsetDays for exactly the follow-up keys", () => {
    const block = MIGRATION_SQL.match(
      /SET "unlockOffsetDays" = 0\s+WHERE "key" IN \(([^)]*)\)/
    );
    assert.ok(block, "unlockOffsetDays update not found");
    const keys = [...block[1]!.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
    assert.deepEqual([...keys].sort(), [...FOLLOW_UP_TEMPLATE_KEYS].sort());
  });

  it("seed matches the migration for follow-up rows", () => {
    assert.match(seedTemplateBlock("qol_3m"), /prerequisiteKeys: \[\],/);
    for (const key of FOLLOW_UP_TEMPLATE_KEYS) {
      assert.match(seedTemplateBlock(key), /unlockOffsetDays: 0,/, key);
    }
  });

  it("seed keeps the ultrasound chain and 3-year booking prerequisites", () => {
    assert.match(
      seedTemplateBlock("pre_tvus_survey"),
      /bookingPrerequisiteKey: "book_ultrasound",/
    );
    assert.match(
      seedTemplateBlock("ultrasound_completed"),
      /prerequisiteKeys: \["pre_tvus_survey"\],/
    );
    assert.match(
      seedTemplateBlock("post_tvus_survey"),
      /prerequisiteKeys: \["ultrasound_completed"\],/
    );
    assert.match(
      seedTemplateBlock("ultrasound_3y_completed"),
      /bookingPrerequisiteKey: "book_ultrasound_3y",/
    );
    assert.match(
      seedTemplateBlock("mri_3y_completed"),
      /bookingPrerequisiteKey: "book_mri_3y",/
    );
  });
});

describe("baseline due date migration and seed", () => {
  const baselineSql = readFileSync(
    path.join(REPO_ROOT, "prisma/migrations/20260927130000_baseline_due_7_days/migration.sql"),
    "utf8"
  );

  it("migration sets qol_baseline dueOffsetDays to BASELINE_DUE_DAYS only", () => {
    assert.match(
      baselineSql,
      new RegExp(`SET "dueOffsetDays" = ${BASELINE_DUE_DAYS}\\s+WHERE "key" = 'qol_baseline';`)
    );
    assert.equal(baselineSql.match(/UPDATE/g)?.length, 1);
  });

  it("seed uses BASELINE_DUE_DAYS for the baseline and 56 days for other Level 1 rows", () => {
    assert.match(seedTemplateBlock("qol_baseline"), /dueOffsetDays: BASELINE_DUE_DAYS,/);
    for (const key of LEVEL_1_REQUIRED_TEMPLATE_KEYS.filter((k) => k !== "qol_baseline")) {
      assert.match(seedTemplateBlock(key), /dueOffsetDays: LEVEL_1_DUE_OFFSET_DAYS,/, key);
    }
  });
});

describe("validateProtocol follow-up checks", () => {
  const steps = FOLLOW_UP_TEMPLATE_KEYS.map((key, i) => ({
    key,
    sortOrder: i,
    unlockOffsetDays: 0,
  }));

  it("accepts follow-up rows with unlockOffsetDays 0", () => {
    const result = validateProtocol(steps, [], {
      followUpTemplateKeys: FOLLOW_UP_TEMPLATE_KEYS,
    });
    assert.deepEqual(result.errors, []);
  });

  it("rejects missing follow-up rows and non-zero day offsets", () => {
    const result = validateProtocol(
      [
        ...steps.filter((s) => s.key !== "qol_9m" && s.key !== "qol_6m"),
        { key: "qol_6m", sortOrder: 99, unlockOffsetDays: 180 },
      ],
      [],
      { followUpTemplateKeys: FOLLOW_UP_TEMPLATE_KEYS }
    );
    assert.ok(result.errors.some((e) => e.includes('"qol_9m" has no ChecklistTemplate')));
    assert.ok(result.errors.some((e) => e.includes('"qol_6m": unlockOffsetDays must be 0')));
  });
});
