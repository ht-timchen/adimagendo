import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChecklistStatus } from "@prisma/client";
import {
  LEVEL_1_PAST_DUE_MESSAGE,
  getLevel1EnrollmentDueLabel,
  getLevel1SummaryText,
} from "@/components/checklist/level-1-enrollment-due-label";
import { MISSING_ENROLLMENT_DATE_MESSAGE } from "@/lib/checklist/enrollment-date-for-timing";
import { ADMIN_LOGICAL_CHECKLIST_STEPS } from "@/lib/admin/checklist-progress";
import {
  buildParticipantProgressRow,
  isItemComputedOverdue,
  type ChecklistTemplateMeta,
} from "@/lib/admin/participant-progress";

/** Run these under several TZ values (e.g. TZ=UTC); results must not change. */

/** 1 Jan 2026, 22:30 Adelaide. Baseline due 8 Jan; other Level 1 items due 26 Feb. */
const ENROLLMENT = new Date("2026-01-01T12:00:00Z");

/** Adelaide midday (ACDT, UTC+10:30) on a January/February 2026 date. */
function adelaideNoon(isoDate: string): Date {
  return new Date(`${isoDate}T01:30:00Z`);
}

function label(
  templateKey: string,
  now: Date = adelaideNoon("2026-01-02"),
  enrollmentDate: Date | null = ENROLLMENT
) {
  return getLevel1EnrollmentDueLabel({
    templateKey,
    enrollmentDate,
    enrollmentDateMissing: enrollmentDate == null,
    now,
  });
}

describe("Level 1 due-by label", () => {
  it("baseline is due enrolment + 7 days", () => {
    assert.equal(label("qol_baseline"), "Due by 8 Jan 2026");
  });

  it("other Level 1 items are due enrolment + 56 days", () => {
    assert.equal(label("book_ultrasound"), "Due by 26 Feb 2026");
    assert.equal(label("confirm_mri"), "Due by 26 Feb 2026");
  });

  it("follow-up items have no due-by label", () => {
    assert.equal(label("qol_3m"), null);
    assert.equal(label("book_ultrasound_3y"), null);
  });

  it("shows the missing enrolment date message for Level 1 items", () => {
    assert.equal(label("qol_baseline", adelaideNoon("2026-03-01"), null), MISSING_ENROLLMENT_DATE_MESSAGE);
  });
});

describe("Level 1 items past their due date (participant view)", () => {
  it("keeps 'Due by' on the due date and switches to calm wording from the next day", () => {
    assert.equal(label("qol_baseline", adelaideNoon("2026-01-08")), "Due by 8 Jan 2026");
    assert.equal(label("qol_baseline", adelaideNoon("2026-01-09")), LEVEL_1_PAST_DUE_MESSAGE);
    assert.equal(LEVEL_1_PAST_DUE_MESSAGE, "Please complete this as soon as you can.");
  });

  it("switches at Adelaide midnight, not UTC midnight", () => {
    // 9 Jan 00:00 Adelaide = 8 Jan 13:30 UTC.
    assert.equal(label("qol_baseline", new Date("2026-01-08T13:29:00Z")), "Due by 8 Jan 2026");
    assert.equal(label("qol_baseline", new Date("2026-01-08T13:30:00Z")), LEVEL_1_PAST_DUE_MESSAGE);
  });

  it("never uses 'overdue' wording", () => {
    for (const key of ["qol_baseline", "book_ultrasound", "confirm_mri"]) {
      for (const day of ["2026-01-09", "2026-02-27", "2026-12-31"]) {
        assert.doesNotMatch(label(key, adelaideNoon(day)) ?? "", /overdue/i, `${key} ${day}`);
      }
    }
  });

  it("56-day items keep 'Due by' until 26 Feb and use calm wording from 27 Feb", () => {
    for (const key of ["book_ultrasound", "ultrasound_completed", "confirm_blood_test", "confirm_mri"]) {
      assert.equal(label(key, adelaideNoon("2026-02-26")), "Due by 26 Feb 2026", key);
      assert.equal(label(key, adelaideNoon("2026-02-27")), LEVEL_1_PAST_DUE_MESSAGE, key);
    }
  });

  it("56-day items switch at Adelaide midnight (27 Feb 00:00 ACDT = 26 Feb 13:30 UTC)", () => {
    assert.equal(label("book_mri", new Date("2026-02-26T13:29:00Z")), "Due by 26 Feb 2026");
    assert.equal(label("book_mri", new Date("2026-02-26T13:30:00Z")), LEVEL_1_PAST_DUE_MESSAGE);
  });

  it("keeps the missing enrolment date message rather than the calm wording", () => {
    assert.equal(
      label("book_ultrasound", adelaideNoon("2026-06-01"), null),
      MISSING_ENROLLMENT_DATE_MESSAGE
    );
  });
});

describe("same participant, same day: participant calm, admin overdue", () => {
  const allKeys = ADMIN_LOGICAL_CHECKLIST_STEPS.flatMap((s) => s.templateKeys);
  const templatesByKey = new Map<string, ChecklistTemplateMeta>(
    allKeys.map((key) => [key, { key, title: key, dueOffsetDays: 56 }])
  );
  const day8 = adelaideNoon("2026-01-09");

  it("day 8 with the baseline outstanding", () => {
    assert.equal(label("qol_baseline", day8), LEVEL_1_PAST_DUE_MESSAGE);

    assert.equal(
      isItemComputedOverdue({
        templateKey: "qol_baseline",
        status: "PENDING",
        enrollmentDate: ENROLLMENT,
        template: templatesByKey.get("qol_baseline"),
        now: day8,
      }),
      true
    );

    const row = buildParticipantProgressRow({
      id: "u1",
      name: "P",
      email: "p@example.test",
      studyRecordId: "R1",
      detailRecordId: "R1",
      isActive: true,
      enrollmentDate: ENROLLMENT,
      items: allKeys.map((templateKey) => ({
        templateKey,
        status: "PENDING" as ChecklistStatus,
      })),
      templatesByKey,
      now: day8,
    });
    assert.equal(row.status, "overdue");
    assert.equal(row.hasOverdueItems, true);
    assert.equal(row.dueDateTone, "overdue");
    assert.equal(row.dueDateLabel, "08/01/2026");
    assert.equal(row.daysLate, 1);
  });

  it("day 57 with a 56-day item (MRI booking) outstanding and the baseline done", () => {
    const day57 = adelaideNoon("2026-02-27");
    assert.equal(label("book_mri", day57), LEVEL_1_PAST_DUE_MESSAGE);
    assert.equal(
      getLevel1SummaryText({
        completedCount: 1,
        totalCount: 9,
        enrollmentDate: ENROLLMENT,
        enrollmentDateMissing: false,
        now: day57,
      }),
      "Level 1 · 1 of 9"
    );

    assert.equal(
      isItemComputedOverdue({
        templateKey: "book_mri",
        status: "PENDING",
        enrollmentDate: ENROLLMENT,
        template: templatesByKey.get("book_mri"),
        now: day57,
      }),
      true
    );

    const row = buildParticipantProgressRow({
      id: "u1",
      name: "P",
      email: "p@example.test",
      studyRecordId: "R1",
      detailRecordId: "R1",
      isActive: true,
      enrollmentDate: ENROLLMENT,
      items: allKeys.map((templateKey) => ({
        templateKey,
        status: (templateKey === "qol_baseline" ? "COMPLETED" : "PENDING") as ChecklistStatus,
      })),
      templatesByKey,
      now: day57,
    });
    assert.equal(row.status, "overdue");
    assert.equal(row.hasOverdueItems, true);
    assert.equal(row.dueDateTone, "overdue");
    assert.equal(row.dueDateLabel, "26/02/2026");
    assert.equal(row.daysLate, 1);
  });
});

describe("Level 1 summary text", () => {
  const base = {
    totalCount: 9,
    enrollmentDate: ENROLLMENT,
    enrollmentDateMissing: false,
    now: adelaideNoon("2026-02-26"),
  };

  it("shows count and the 56-day complete-by date", () => {
    assert.equal(
      getLevel1SummaryText({ ...base, completedCount: 4 }),
      "Level 1 · 4 of 9 · complete by 26 Feb 2026"
    );
  });

  it("drops the date once it has passed (from 27 Feb Adelaide)", () => {
    assert.equal(
      getLevel1SummaryText({ ...base, completedCount: 4, now: new Date("2026-02-26T13:29:00Z") }),
      "Level 1 · 4 of 9 · complete by 26 Feb 2026"
    );
    assert.equal(
      getLevel1SummaryText({ ...base, completedCount: 4, now: new Date("2026-02-26T13:30:00Z") }),
      "Level 1 · 4 of 9"
    );
  });

  it("omits the date when the enrolment date is missing", () => {
    assert.equal(
      getLevel1SummaryText({
        ...base,
        completedCount: 0,
        enrollmentDate: null,
        enrollmentDateMissing: true,
      }),
      "Level 1 · 0 of 9"
    );
  });

  it("says complete once all Level 1 items are done", () => {
    assert.equal(getLevel1SummaryText({ ...base, completedCount: 9 }), "Level 1 · complete");
  });
});
