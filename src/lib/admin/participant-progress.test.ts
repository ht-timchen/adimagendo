import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChecklistStatus } from "@prisma/client";
import {
  ADMIN_CHECKLIST_STEP_TOTAL,
  ADMIN_LOGICAL_CHECKLIST_STEPS,
} from "./checklist-progress";
import {
  buildParticipantProgressRow,
  isItemComputedOverdue,
  type ChecklistTemplateMeta,
} from "./participant-progress";
import { LEVEL_1_REQUIRED_TEMPLATE_KEYS } from "@/lib/checklist/early-clinical-protocol";
import {
  FOLLOW_UP_GRACE_DAYS,
  THREE_YEAR_IMAGING_TEMPLATE_KEYS,
} from "@/lib/checklist/protocol-timing";
import {
  addCivilDays,
  adelaideMidnightUtc,
  type CivilDate,
} from "@/lib/dates/adelaide-calendar";

/** 1 Jan 2026, 22:30 Adelaide. */
const ENROLLMENT = new Date("2026-01-01T12:00:00Z");

/** Legacy stored dueOffsetDays (qol_baseline still 56 before the data migration); all must be ignored. */
const SEEDED_DUE_OFFSET_DAYS: Record<string, number> = {
  qol_3m: 90,
  qol_6m: 180,
  qol_9m: 270,
  qol_12m: 360,
  book_ultrasound_3y: 912,
  book_mri_3y: 912,
  qol_24m: 730,
  ultrasound_3y_completed: 1095,
  mri_3y_completed: 1095,
  qol_36m: 1095,
};

const ALL_KEYS = ADMIN_LOGICAL_CHECKLIST_STEPS.flatMap((s) => s.templateKeys);

const templatesByKey = new Map<string, ChecklistTemplateMeta>(
  ALL_KEYS.map((key) => [
    key,
    {
      key,
      title: key,
      dueOffsetDays: SEEDED_DUE_OFFSET_DAYS[key] ?? 56,
    },
  ])
);

/** Adelaide midday on a calendar date (ACDT until 5 Apr 2026, then ACST). */
function adelaideNoon(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const dst = y === 2026 && (m < 4 || (m === 4 && d < 5));
  return new Date(Date.UTC(y, m - 1, d, dst ? 1 : 2, 30));
}

function row(completedKeys: string[], now: Date) {
  const completed = new Set(completedKeys);
  return buildParticipantProgressRow({
    id: "u1",
    name: "P",
    email: "p@example.test",
    studyRecordId: "R1",
    detailRecordId: "R1",
    isActive: true,
    enrollmentDate: ENROLLMENT,
    items: ALL_KEYS.map((templateKey) => ({
      templateKey,
      status: (completed.has(templateKey) ? "COMPLETED" : "PENDING") as ChecklistStatus,
    })),
    templatesByKey,
    now,
  });
}

function overdue(templateKey: string, now: Date): boolean {
  return isItemComputedOverdue({
    templateKey,
    status: "PENDING",
    enrollmentDate: ENROLLMENT,
    template: templatesByKey.get(templateKey),
    now,
  });
}

describe("admin overdue: Level 1", () => {
  it("baseline is overdue from enrolment + 8 days, ignoring a stale dueOffsetDays of 56", () => {
    assert.equal(templatesByKey.get("qol_baseline")?.dueOffsetDays, 56);
    assert.equal(overdue("qol_baseline", adelaideNoon("2026-01-08")), false);
    assert.equal(overdue("qol_baseline", adelaideNoon("2026-01-09")), true);
    assert.equal(row([], adelaideNoon("2026-01-08")).hasOverdueItems, false);
    assert.equal(row([], adelaideNoon("2026-01-09")).hasOverdueItems, true);
  });

  it("other Level 1 items stay overdue from enrolment + 57 days", () => {
    for (const key of LEVEL_1_REQUIRED_TEMPLATE_KEYS.filter((k) => k !== "qol_baseline")) {
      assert.equal(overdue(key, adelaideNoon("2026-02-26")), false, key);
      assert.equal(overdue(key, adelaideNoon("2026-02-27")), true, key);
    }
    const baselineDone = ["qol_baseline"];
    assert.equal(row(baselineDone, adelaideNoon("2026-02-26")).hasOverdueItems, false);
    assert.equal(row(baselineDone, adelaideNoon("2026-02-27")).hasOverdueItems, true);
  });
});

/** qol_3m opens 1 Apr 2026 for ENROLLMENT. */
const QOL_3M_OPENS = { year: 2026, month: 4, day: 1 };
const QOL_3M_LAST_NOT_OVERDUE = addCivilDays(QOL_3M_OPENS, FOLLOW_UP_GRACE_DAYS);
const QOL_3M_FIRST_OVERDUE = addCivilDays(QOL_3M_LAST_NOT_OVERDUE, 1);

function noonOn(date: CivilDate): Date {
  return new Date(adelaideMidnightUtc(date).getTime() + 12 * 60 * 60 * 1000);
}

describe("admin overdue: follow-ups (unlock + grace)", () => {
  it("is not overdue on unlock + FOLLOW_UP_GRACE_DAYS and overdue from the next day", () => {
    assert.equal(overdue("qol_3m", noonOn(QOL_3M_OPENS)), false);
    assert.equal(overdue("qol_3m", noonOn(QOL_3M_LAST_NOT_OVERDUE)), false);
    assert.equal(overdue("qol_3m", noonOn(QOL_3M_FIRST_OVERDUE)), true);
  });

  it("ignores legacy dueOffsetDays on follow-up rows", () => {
    // Legacy qol_3m dueOffsetDays 90 would have made it overdue from 2 Apr.
    assert.equal(overdue("qol_3m", adelaideNoon("2026-04-10")), false);
  });

  it("uses the Adelaide date at the day boundary", () => {
    const midnight = adelaideMidnightUtc(QOL_3M_FIRST_OVERDUE).getTime();
    assert.equal(overdue("qol_3m", new Date(midnight - 1000)), false);
    assert.equal(overdue("qol_3m", new Date(midnight)), true);
  });

  it("row is overdue only once a follow-up passes its threshold", () => {
    const level1 = [...LEVEL_1_REQUIRED_TEMPLATE_KEYS];
    assert.equal(row(level1, noonOn(QOL_3M_LAST_NOT_OVERDUE)).status, "on_track");
    assert.equal(row(level1, noonOn(QOL_3M_FIRST_OVERDUE)).status, "overdue");
  });
});

describe("admin overdue: 3-year imaging excluded", () => {
  it("never marks 3-year imaging items overdue", () => {
    const farFuture = new Date("2035-01-01T00:00:00Z");
    for (const key of THREE_YEAR_IMAGING_TEMPLATE_KEYS) {
      assert.equal(overdue(key, farFuture), false, key);
    }
  });

  it("row stays on track when only 3-year imaging is outstanding", () => {
    const imaging = new Set<string>(THREE_YEAR_IMAGING_TEMPLATE_KEYS);
    const done = ALL_KEYS.filter((k) => !imaging.has(k));
    const r = row(done, new Date("2035-01-01T00:00:00Z"));
    assert.equal(r.hasOverdueItems, false);
    assert.equal(r.status, "on_track");
    assert.equal(r.total, 19);
    assert.equal(r.completed, 15);
  });

  it("qol_36m is still subject to overdue", () => {
    assert.equal(overdue("qol_36m", new Date("2035-01-01T00:00:00Z")), true);
  });
});

describe("admin next date display", () => {
  const level1 = [...LEVEL_1_REQUIRED_TEMPLATE_KEYS];

  it("shows enrolment + 7 days while the baseline survey is next", () => {
    const r = row([], adelaideNoon("2026-01-05"));
    assert.equal(r.dueDateLabel, "08/01/2026");
    assert.equal(r.dueDateTone, "this_week");
  });

  it("shows the 56-day Level 1 due date once the baseline is done", () => {
    const r = row(["qol_baseline"], adelaideNoon("2026-02-01"));
    assert.equal(r.dueDateLabel, "26/02/2026");
    assert.equal(r.dueDateTone, "default");
  });

  it("labels a future follow-up with its unlock date", () => {
    const r = row(level1, adelaideNoon("2026-02-01"));
    assert.equal(r.dueDateLabel, "Opens 01/04/2026");
    assert.equal(r.dueDateTone, "default");
    assert.equal(r.daysLate, null);
  });

  it("shows an open follow-up as opened, not overdue, within the grace period", () => {
    const r = row(level1, adelaideNoon("2026-04-10"));
    assert.equal(r.dueDateLabel, "Opened 01/04/2026");
    assert.equal(r.dueDateTone, "default");
  });

  it("marks the follow-up overdue with days late counted from the threshold", () => {
    const r = row(level1, noonOn(addCivilDays(QOL_3M_LAST_NOT_OVERDUE, 5)));
    assert.equal(r.dueDateTone, "overdue");
    assert.equal(r.daysLate, 5);
  });

  it("keeps the admin total at 19", () => {
    assert.equal(ADMIN_CHECKLIST_STEP_TOTAL, 19);
    assert.equal(ALL_KEYS.length, 19);
  });
});
