import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BOOKING_GROUP_DEFINITIONS,
  isKnownBookingGroupKey,
} from "@/lib/checklist-booking-group";
import { LEVEL_1_REQUIRED_TEMPLATE_KEYS } from "@/lib/checklist/early-clinical-protocol";
import {
  LEVEL_2_REQUIRED_TEMPLATE_KEYS,
  LEVEL_3_REQUIRED_TEMPLATE_KEYS,
} from "@/lib/checklist/level2-follow-up";
import {
  getFollowUpUnlock,
  getSurveyWindow,
} from "@/lib/checklist/follow-up-availability";
import {
  addCalendarMonths,
  addCivilDays,
  adelaideCivilDate,
  adelaideMidnightUtc,
} from "@/lib/dates/adelaide-calendar";
import {
  closingSoonSummaryText,
  collectChecklistCardSlots,
  groupChecklistCards,
  showsDueDate,
  TODO_INITIAL_VISIBLE_CARDS,
  type ChecklistCardEntry,
  type ChecklistSections,
} from "@/lib/checklist/checklist-sections";
import {
  ChecklistCollapsibleSection,
  ChecklistShowMore,
} from "@/components/checklist/checklist-section";

function entry(key: string, overrides: Partial<ChecklistCardEntry> = {}): ChecklistCardEntry {
  return {
    key,
    title: key,
    order: 0,
    completed: false,
    timeGate: { kind: "open" },
    prerequisitesMet: true,
    surveyWindow: null,
    ...overrides,
  };
}

function openSurvey(key: string, order: number, daysLeft: number): ChecklistCardEntry {
  return entry(key, {
    order,
    surveyWindow: { state: daysLeft === 1 ? "last_day" : "open", daysLeft },
  });
}

function keys(list: readonly ChecklistCardEntry[]): string[] {
  return list.map((e) => e.key);
}

function allSectionKeys(s: ChecklistSections): string[] {
  return [...s.todo, ...s.comingUp, ...s.waiting, ...s.later, ...s.completed].map(
    (e) => e.key
  );
}

// ---- Real template keys and booking groups, in Level then template order ----

const GROUP_KEY_BY_TEMPLATE = new Map<string, string>(
  Object.entries(BOOKING_GROUP_DEFINITIONS).flatMap(([groupKey, def]) =>
    def.rows.map((row) => [row.templateKey, groupKey] as const)
  )
);

type TemplateStub = { key: string; completionGroupKey: string | null };

const LEVELS = [
  LEVEL_1_REQUIRED_TEMPLATE_KEYS,
  LEVEL_2_REQUIRED_TEMPLATE_KEYS,
  LEVEL_3_REQUIRED_TEMPLATE_KEYS,
].map((levelKeys, i) => ({
  label: `Level ${i + 1}`,
  templates: levelKeys.map(
    (key): TemplateStub => ({
      key,
      completionGroupKey: GROUP_KEY_BY_TEMPLATE.get(key) ?? null,
    })
  ),
}));

const SLOTS = collectChecklistCardSlots(LEVELS, isKnownBookingGroupKey);
const ALL_TEMPLATE_KEYS = LEVELS.flatMap((l) => l.templates.map((t) => t.key));

function slotKey(t: TemplateStub): string {
  return t.completionGroupKey ?? t.key;
}

function slotTemplateKeys(t: TemplateStub): string[] {
  return t.completionGroupKey
    ? BOOKING_GROUP_DEFINITIONS[t.completionGroupKey]!.rows.map((r) => r.templateKey)
    : [t.key];
}

// ---- Scenario model mirroring the page inputs (timing from protocol months) ----

const ENROLLED = new Date("2026-01-15T02:00:00Z");
const ENROLLED_CIVIL = adelaideCivilDate(ENROLLED);

function atMonthsPlusDays(months: number, days = 0): Date {
  const civil = addCivilDays(addCalendarMonths(ENROLLED_CIVIL, months), days);
  return new Date(adelaideMidnightUtc(civil).getTime() + 12 * 60 * 60 * 1000);
}

type Scenario = {
  now: Date;
  enrollmentMissing?: boolean;
  completed?: string[];
  /** Booking rows booked externally (with a date for the ultrasound). */
  booked?: string[];
};

const PREREQUISITES: Record<string, (s: Required<Scenario>) => boolean> = {
  pre_tvus_survey: (s) =>
    s.booked.includes("book_ultrasound") || s.completed.includes("book_ultrasound"),
  ultrasound_completed: (s) => s.completed.includes("pre_tvus_survey"),
  post_tvus_survey: (s) => s.completed.includes("ultrasound_completed"),
  confirm_blood_test: (s) => s.completed.includes("book_bloods"),
  confirm_mri: (s) => s.completed.includes("book_mri"),
  ultrasound_3y_completed: (s) =>
    s.booked.includes("book_ultrasound_3y") || s.completed.includes("book_ultrasound_3y"),
  mri_3y_completed: (s) =>
    s.booked.includes("book_mri_3y") || s.completed.includes("book_mri_3y"),
};

function buildEntries(input: Scenario): ChecklistCardEntry[] {
  const s: Required<Scenario> = {
    enrollmentMissing: false,
    completed: [],
    booked: [],
    ...input,
  };
  return SLOTS.map(({ template }, order) => {
    const gateKey = template.completionGroupKey
      ? BOOKING_GROUP_DEFINITIONS[template.completionGroupKey]!.unlockTemplateKey
      : template.key;
    const unlock = getFollowUpUnlock(gateKey, ENROLLED);
    const timeGate: ChecklistCardEntry["timeGate"] =
      unlock == null
        ? { kind: "open" }
        : s.enrollmentMissing
          ? { kind: "enrollment_date_missing" }
          : s.now < unlock.unlocksAt
            ? { kind: "opens_later", opensAt: unlock.unlocksAt }
            : { kind: "open" };
    const window = s.enrollmentMissing
      ? null
      : getSurveyWindow(template.key, ENROLLED, s.now);
    return entry(slotKey(template), {
      order,
      completed: slotTemplateKeys(template).every((k) => s.completed.includes(k)),
      timeGate,
      prerequisitesMet: PREREQUISITES[gateKey]?.(s) ?? true,
      surveyWindow: window ? { state: window.state, daysLeft: window.daysLeft } : null,
    });
  });
}

function assertPartition(s: ChecklistSections, label: string) {
  const expected = SLOTS.map(({ template }) => slotKey(template));
  const actual = allSectionKeys(s);
  assert.equal(actual.length, expected.length, `${label}: card count`);
  assert.equal(new Set(actual).size, actual.length, `${label}: no duplicates`);
  assert.deepEqual([...actual].sort(), [...expected].sort(), `${label}: no lost cards`);
  assert.deepEqual(
    keys([...s.todoVisible, ...s.todoHidden]),
    keys(s.todo),
    `${label}: visible + hidden = to do`
  );
  assert.ok(s.todoVisible.length <= TODO_INITIAL_VISIBLE_CARDS, `${label}: cap`);
  assert.ok(s.comingUp.length <= 2, `${label}: coming up max`);
  assert.ok(
    s.comingUp.every((e) => e.timeGate.kind === "opens_later"),
    `${label}: coming up has real dates`
  );
  assert.equal(s.sectionOf.size, expected.length, `${label}: every card has a section`);
  const lists = {
    todo: s.todo,
    comingUp: s.comingUp,
    waiting: s.waiting,
    later: s.later,
    completed: s.completed,
  };
  for (const [section, list] of Object.entries(lists)) {
    for (const e of list) {
      assert.equal(s.sectionOf.get(e.key), section, `${label}: ${e.key} section`);
    }
  }
  const dueKeys = [...s.sectionOf].filter(([, sec]) => showsDueDate(sec)).map(([k]) => k);
  assert.deepEqual(dueKeys.sort(), keys(s.todo).sort(), `${label}: due only in To do now`);
}

describe("collectChecklistCardSlots (real templates)", () => {
  it("produces 16 cards covering all 19 template keys exactly once", () => {
    assert.equal(ALL_TEMPLATE_KEYS.length, 19);
    assert.equal(SLOTS.length, 16);
    const covered = SLOTS.flatMap(({ template }) => slotTemplateKeys(template));
    assert.equal(covered.length, 19);
    assert.deepEqual([...covered].sort(), [...ALL_TEMPLATE_KEYS].sort());
  });

  it("keeps each booking group in its own Level", () => {
    const group1 = SLOTS.find((s) => s.template.completionGroupKey === "book_appointments");
    const group3 = SLOTS.find((s) => s.template.completionGroupKey === "book_appointments_3y");
    assert.equal(group1?.level.label, "Level 1");
    assert.equal(group3?.level.label, "Level 3");
  });
});

describe("groupChecklistCards: section rules", () => {
  it("puts each state in its section", () => {
    const s = groupChecklistCards([
      entry("done", { order: 0, completed: true }),
      entry("todo", { order: 1 }),
      entry("blocked", { order: 2, prerequisitesMet: false }),
      entry("future", {
        order: 3,
        timeGate: { kind: "opens_later", opensAt: new Date("2027-01-01") },
      }),
      entry("no-date", { order: 4, timeGate: { kind: "enrollment_date_missing" } }),
    ]);
    assert.deepEqual(keys(s.completed), ["done"]);
    assert.deepEqual(keys(s.todo), ["todo"]);
    assert.deepEqual(keys(s.waiting), ["blocked"]);
    assert.deepEqual(keys(s.comingUp), ["future"]);
    assert.deepEqual(keys(s.later), ["no-date"]);
  });

  it("time lock wins over a prerequisite; after the date the card waits", () => {
    const opensAt = new Date("2029-01-15T00:00:00Z");
    const locked = entry("us3y", {
      timeGate: { kind: "opens_later", opensAt },
      prerequisitesMet: false,
    });
    assert.deepEqual(keys(groupChecklistCards([locked]).comingUp), ["us3y"]);
    const afterDate = { ...locked, timeGate: { kind: "open" as const } };
    assert.deepEqual(keys(groupChecklistCards([afterDate]).waiting), ["us3y"]);
  });

  it("coming up takes the two earliest dates; ties keep page order", () => {
    const same = new Date("2029-01-15T00:00:00Z");
    const s = groupChecklistCards([
      entry("later-date", {
        order: 0,
        timeGate: { kind: "opens_later", opensAt: new Date("2030-01-01") },
      }),
      entry("tie-b", { order: 2, timeGate: { kind: "opens_later", opensAt: same } }),
      entry("tie-a", { order: 1, timeGate: { kind: "opens_later", opensAt: same } }),
      entry("tie-c", { order: 3, timeGate: { kind: "opens_later", opensAt: same } }),
    ]);
    assert.deepEqual(keys(s.comingUp), ["tie-a", "tie-b"]);
    assert.deepEqual(keys(s.later), ["tie-c", "later-date"]);
  });

  it("returns an empty to-do list when nothing is actionable", () => {
    const s = groupChecklistCards([entry("a", { completed: true })]);
    assert.equal(s.todo.length, 0);
    assert.equal(s.todoHidden.length, 0);
  });
});

describe("due dates by section", () => {
  it("only To do now shows due dates; Waiting shows none", () => {
    assert.equal(showsDueDate("todo"), true);
    for (const section of ["comingUp", "waiting", "later", "completed"] as const) {
      assert.equal(showsDueDate(section), false, section);
    }
    assert.equal(showsDueDate(undefined), false);
  });

  it("day 0: baseline and bookings show due; Pre-TVUS and later Level 1 steps wait without one", () => {
    const s = groupChecklistCards(buildEntries({ now: atMonthsPlusDays(0) }));
    assert.equal(s.sectionOf.get("qol_baseline"), "todo");
    assert.equal(s.sectionOf.get("book_appointments"), "todo");
    for (const key of ["pre_tvus_survey", "ultrasound_completed", "post_tvus_survey"]) {
      assert.equal(s.sectionOf.get(key), "waiting", key);
      assert.equal(showsDueDate(s.sectionOf.get(key)), false, key);
    }
  });
});

describe("groupChecklistCards: to-do sorting and cap", () => {
  it("surveys closing in 3 and 5 days come before ordinary tasks, in that order", () => {
    const s = groupChecklistCards([
      entry("ordinary-a", { order: 0 }),
      openSurvey("survey-5d", 1, 5),
      entry("ordinary-b", { order: 2 }),
      openSurvey("survey-3d", 3, 3),
      openSurvey("survey-20d", 4, 20),
    ]);
    assert.deepEqual(keys(s.todo), [
      "survey-3d",
      "survey-5d",
      "ordinary-a",
      "ordinary-b",
      "survey-20d",
    ]);
  });

  it("last day comes first and closed surveys come last", () => {
    const s = groupChecklistCards([
      entry("closed", {
        order: 0,
        surveyWindow: { state: "closed", daysLeft: null },
      }),
      entry("ordinary", { order: 1 }),
      openSurvey("survey-3d", 2, 3),
      openSurvey("last-day", 3, 1),
    ]);
    assert.deepEqual(keys(s.todo), ["last-day", "survey-3d", "ordinary", "closed"]);
  });

  it("shows 3 and summarises hidden surveys that close soon", () => {
    const s = groupChecklistCards([
      openSurvey("s2", 0, 2),
      openSurvey("s3", 1, 3),
      openSurvey("s4", 2, 4),
      openSurvey("s6", 3, 6),
      entry("ordinary", { order: 4 }),
      openSurvey("s20", 5, 20),
    ]);
    assert.deepEqual(keys(s.todoVisible), ["s2", "s3", "s4"]);
    assert.deepEqual(keys(s.todoHidden), ["s6", "ordinary", "s20"]);
    assert.deepEqual(keys(s.todoHiddenClosingSoon), ["s6"]);
    assert.equal(closingSoonSummaryText(s.todoHiddenClosingSoon[0]!), "s6 · 6 days left");
    assert.equal(
      closingSoonSummaryText(openSurvey("x", 0, 1)),
      "x · last day today"
    );
  });
});

describe("groupChecklistCards: partial booking groups", () => {
  it("a partly booked group is one to-do card; fully confirmed goes to Completed", () => {
    const partial = groupChecklistCards(
      buildEntries({
        now: atMonthsPlusDays(0, 3),
        completed: ["qol_baseline", "book_ultrasound"],
        booked: ["book_mri"],
      })
    );
    assert.ok(keys(partial.todo).includes("book_appointments"));
    assert.equal(allSectionKeys(partial).filter((k) => k === "book_appointments").length, 1);
    assertPartition(partial, "partial");

    const done = groupChecklistCards(
      buildEntries({
        now: atMonthsPlusDays(0, 3),
        completed: ["book_ultrasound", "book_mri", "book_bloods"],
      })
    );
    assert.ok(keys(done.completed).includes("book_appointments"));
  });

  it("the 3-year booking group is future before 30 months and to-do after", () => {
    const before = groupChecklistCards(buildEntries({ now: atMonthsPlusDays(29) }));
    assert.ok(
      [...keys(before.comingUp), ...keys(before.later)].includes("book_appointments_3y")
    );
    const after = groupChecklistCards(buildEntries({ now: atMonthsPlusDays(30) }));
    assert.ok(keys(after.todo).includes("book_appointments_3y"));
  });
});

describe("groupChecklistCards: no lost or duplicated cards across the study", () => {
  const ALL_KEYS = ALL_TEMPLATE_KEYS;
  const scenarios: [string, Scenario][] = [
    ["day 0", { now: atMonthsPlusDays(0) }],
    ["ultrasound booked", { now: atMonthsPlusDays(0, 10), booked: ["book_ultrasound"] }],
    ["3 months", { now: atMonthsPlusDays(3, 1), completed: ["qol_baseline"] }],
    ["12 months", { now: atMonthsPlusDays(12, 2) }],
    ["30 months", { now: atMonthsPlusDays(30) }],
    ["36 months", { now: atMonthsPlusDays(36), booked: ["book_ultrasound_3y"] }],
    ["40 months, windows closed", { now: atMonthsPlusDays(40) }],
    ["all complete", { now: atMonthsPlusDays(40), completed: ALL_KEYS }],
    ["enrolment date missing", { now: atMonthsPlusDays(5), enrollmentMissing: true }],
  ];

  for (const [label, scenario] of scenarios) {
    it(label, () => {
      assertPartition(groupChecklistCards(buildEntries(scenario)), label);
    });
  }

  it("at 36 months the three same-day items split 2 coming up / 1 later the day before", () => {
    const s = groupChecklistCards(
      buildEntries({ now: atMonthsPlusDays(36, -1), completed: ALL_KEYS.slice(0, 16) })
    );
    assert.deepEqual(keys(s.comingUp), ["ultrasound_3y_completed", "mri_3y_completed"]);
    assert.deepEqual(keys(s.later), ["qol_36m"]);
  });

  it("everything complete leaves To do now empty", () => {
    const s = groupChecklistCards(
      buildEntries({ now: atMonthsPlusDays(40), completed: ALL_KEYS })
    );
    assert.equal(s.todo.length, 0);
    assert.equal(s.completed.length, 16);
  });
});

describe("section markup", () => {
  it("collapsible sections and Show more start closed", () => {
    const section = renderToStaticMarkup(
      ChecklistCollapsibleSection({ title: "Completed", count: 4, children: "x" })
    );
    assert.match(section, /^<details/);
    assert.doesNotMatch(section, /<details[^>]*\sopen/);
    assert.match(section, /Completed/);
    assert.match(section, /\(<!-- -->4<!-- -->\)|\(4\)/);

    const more = renderToStaticMarkup(
      ChecklistShowMore({ hiddenCount: 2, children: "x" })
    );
    assert.doesNotMatch(more, /<details[^>]*\sopen/);
    assert.match(more, /Show <!-- -->2<!-- --> more|Show 2 more/);
  });
});
