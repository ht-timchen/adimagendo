import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { LEVEL_1_REQUIRED_TEMPLATE_KEYS } from "@/lib/checklist/early-clinical-protocol";
import {
  LEVEL_2_REQUIRED_TEMPLATE_KEYS,
  LEVEL_3_REQUIRED_TEMPLATE_KEYS,
} from "@/lib/checklist/level2-follow-up";
import {
  buildSearchIndex,
  CHECKLIST_SEARCH_SYNONYMS,
  checklistItemAnchorId,
  isChecklistItemAnchorId,
  normaliseSearchText,
  PAGE_SEARCH_ENTRIES,
  searchEntries,
  SEARCH_RESULT_LIMIT,
} from "./search-index";

const ALL_TEMPLATE_KEYS = [
  ...LEVEL_1_REQUIRED_TEMPLATE_KEYS,
  ...LEVEL_2_REQUIRED_TEMPLATE_KEYS,
  ...LEVEL_3_REQUIRED_TEMPLATE_KEYS,
];

const SEED_TITLES: Record<string, string> = {
  qol_baseline: "Baseline QoL survey",
  book_ultrasound: "Book ultrasound",
  book_mri: "Book MRI",
  book_bloods: "Book blood test",
  pre_tvus_survey: "Pre-TVUS survey",
  ultrasound_completed: "Ultrasound completed",
  post_tvus_survey: "Post-TVUS survey",
  confirm_blood_test: "Blood test completed",
  confirm_mri: "MRI completed",
  qol_3m: "3-month survey",
  qol_6m: "6-month survey",
  qol_9m: "9-month survey",
  qol_12m: "12-month survey",
  book_ultrasound_3y: "Ultrasound (3-year)",
  book_mri_3y: "MRI (3-year)",
  qol_24m: "24-month survey",
  ultrasound_3y_completed: "3-year Ultrasound completed",
  mri_3y_completed: "3-year MRI completed",
  qol_36m: "36-month survey",
};

const fullIndex = buildSearchIndex(
  ALL_TEMPLATE_KEYS.map((key) => ({ key, title: SEED_TITLES[key] }))
);

function checklistKeysFor(query: string): string[] {
  return searchEntries(fullIndex, query, 50)
    .filter((e) => e.kind === "checklist")
    .map((e) => e.id.replace(/^checklist-/, ""));
}

describe("search index coverage", () => {
  it("has synonyms for exactly the 19 study template keys", () => {
    assert.equal(ALL_TEMPLATE_KEYS.length, 19);
    assert.deepEqual(
      Object.keys(CHECKLIST_SEARCH_SYNONYMS).sort(),
      [...ALL_TEMPLATE_KEYS].sort()
    );
  });

  it("builds one checklist entry per key, linking to that item's anchor", () => {
    const checklist = fullIndex.filter((e) => e.kind === "checklist");
    assert.equal(checklist.length, 19);
    for (const entry of checklist) {
      const key = entry.id.replace(/^checklist-/, "");
      assert.equal(entry.href, `/dashboard/checklist#${checklistItemAnchorId(key)}`);
      assert.ok(isChecklistItemAnchorId(checklistItemAnchorId(key)));
    }
  });

  it("only includes checklist items the participant has, using their titles", () => {
    const index = buildSearchIndex([
      { key: "book_mri", title: "Book MRI" },
      { key: "not_a_study_key", title: "Something else" },
    ]);
    const checklist = index.filter((e) => e.kind === "checklist");
    assert.deepEqual(checklist.map((e) => e.label), ["Book MRI"]);
  });
});

describe("synonyms", () => {
  const ultrasoundKeys = [
    "book_ultrasound",
    "ultrasound_completed",
    "book_ultrasound_3y",
    "ultrasound_3y_completed",
  ];
  const mriKeys = ["book_mri", "confirm_mri", "book_mri_3y", "mri_3y_completed"];
  const bloodKeys = ["book_bloods", "confirm_blood_test"];

  for (const query of ["ultrasound", "TVUS", "taus"]) {
    it(`"${query}" finds every ultrasound item`, () => {
      const keys = checklistKeysFor(query);
      for (const key of ultrasoundKeys) assert.ok(keys.includes(key), `${query} → ${key}`);
    });
  }

  it('"scan" finds ultrasound and MRI items', () => {
    const keys = checklistKeysFor("scan");
    for (const key of [...ultrasoundKeys, ...mriKeys]) assert.ok(keys.includes(key), key);
    assert.ok(!keys.includes("book_bloods"));
  });

  for (const query of ["blood", "bloods", "blood test", "pathology"]) {
    it(`"${query}" finds the blood items and no MRI items`, () => {
      const keys = checklistKeysFor(query);
      assert.deepEqual([...keys].sort(), [...bloodKeys].sort());
    });
  }

  it('"MRI" finds every MRI item', () => {
    const keys = checklistKeysFor("MRI");
    assert.deepEqual([...keys].sort(), [...mriKeys].sort());
  });

  for (const query of ["survey", "questionnaire", "QoL"]) {
    it(`"${query}" finds all nine surveys`, () => {
      const keys = checklistKeysFor(query);
      for (const key of ALL_TEMPLATE_KEYS.filter((k) => k.startsWith("qol_") || k.endsWith("_survey"))) {
        assert.ok(keys.includes(key), `${query} → ${key}`);
      }
    });
  }

  it("matches page names and their synonyms", () => {
    assert.equal(searchEntries(fullIndex, "profile")[0]?.href, "/dashboard/profile");
    assert.equal(searchEntries(fullIndex, "school")[0]?.href, "/dashboard/absences");
    assert.equal(searchEntries(fullIndex, "help")[0]?.href, "/dashboard/contact");
  });

  it("ranks a label match above a synonym match", () => {
    assert.equal(searchEntries(fullIndex, "book mri")[0]?.label, "Book MRI");
  });

  it("is case and punctuation insensitive, keeps decimals and caps results", () => {
    assert.equal(normaliseSearchText("  Pre-TVUS   Survey! "), "pre tvus survey");
    assert.equal(normaliseSearchText("2.5-year."), "2.5 year");
    assert.deepEqual(searchEntries(fullIndex, "   "), []);
    assert.ok(searchEntries(fullIndex, "s").length <= SEARCH_RESULT_LIMIT);
  });
});

describe("privacy", () => {
  it("only produces page and checklist entries; checklist entries link to the checklist", () => {
    for (const entry of fullIndex) {
      assert.ok(entry.kind === "page" || entry.kind === "checklist");
      if (entry.kind === "checklist") assert.ok(entry.href.startsWith("/dashboard/checklist#"));
    }
    assert.ok(PAGE_SEARCH_ENTRIES.every((e) => e.kind === "page"));
  });

  it("does not import or reference symptom, diary or appointment data sources", () => {
    const source = readFileSync(path.join(__dirname, "search-index.ts"), "utf8");
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(imports, ["@/lib/participant-routes"]);
    assert.doesNotMatch(source, /prisma|symptomEntry|absence[A-Z]|appointment\.|fetch\(|localStorage|sessionStorage|console\./);
  });
});
