import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChecklistSurveyWindowNote } from "@/components/checklist/checklist-survey-window-note";
import { addCivilDays, adelaideMidnightUtc } from "@/lib/dates/adelaide-calendar";
import { getSurveyWindow, surveyWindowTestLabel } from "./follow-up-availability";
import {
  FOLLOW_UP_SURVEY_TEMPLATE_KEYS,
  SURVEY_WINDOW_DAYS,
  THREE_YEAR_IMAGING_TEMPLATE_KEYS,
} from "./protocol-timing";

/** 1 Jan 2026 Adelaide; qol_3m opens 1 Apr 2026. */
const ENROLLMENT = new Date("2026-01-01T12:00:00Z");
/** Fixed window for wording tests, independent of the configured test value. */
const WINDOW = 30;

function noonAdelaide(year: number, month: number, day: number): Date {
  return new Date(adelaideMidnightUtc({ year, month, day }).getTime() + 12 * 3600 * 1000);
}

function windowOn(year: number, month: number, day: number, windowDays = WINDOW) {
  return getSurveyWindow("qol_3m", ENROLLMENT, noonAdelaide(year, month, day), windowDays);
}

describe("survey window states", () => {
  it("before opening: shows the open date and window length", () => {
    const w = windowOn(2026, 3, 31);
    assert.equal(w?.state, "upcoming");
    assert.equal(w?.text, "Available from 1 Apr 2026 · open for 30 days");
  });

  it("open with more than 7 days left: date only", () => {
    const first = windowOn(2026, 4, 1);
    assert.equal(first?.state, "open");
    assert.equal(first?.daysLeft, 30);
    assert.equal(first?.text, "Open until 30 Apr 2026");
    assert.equal(windowOn(2026, 4, 23)?.text, "Open until 30 Apr 2026");
  });

  it("open with 2–7 days left: date and days left", () => {
    assert.equal(windowOn(2026, 4, 24)?.text, "Open until 30 Apr 2026 · 7 days left");
    assert.equal(windowOn(2026, 4, 29)?.text, "Open until 30 Apr 2026 · 2 days left");
  });

  it("last day", () => {
    const w = windowOn(2026, 4, 30);
    assert.equal(w?.state, "last_day");
    assert.equal(w?.text, "Last day to complete: today (30 Apr 2026)");
  });

  it("after the window: closed message", () => {
    const w = windowOn(2026, 5, 1);
    assert.equal(w?.state, "closed");
    assert.equal(w?.text, "This survey closed on 30 Apr 2026.");
  });

  it("closes at 00:00 Adelaide after the last day", () => {
    // 1 May 2026 00:00 ACST = 2026-04-30T14:30Z.
    const at = (iso: string) => getSurveyWindow("qol_3m", ENROLLMENT, new Date(iso), WINDOW);
    assert.equal(at("2026-04-30T14:29:59Z")?.state, "last_day");
    assert.equal(at("2026-04-30T14:30:00Z")?.state, "closed");
  });

  it("'Open until' is unlock date + windowDays - 1", () => {
    assert.equal(windowOn(2026, 4, 1, 10)?.text, "Open until 10 Apr 2026");
    assert.deepEqual(
      windowOn(2026, 4, 1, SURVEY_WINDOW_DAYS)?.lastDate,
      addCivilDays({ year: 2026, month: 4, day: 1 }, SURVEY_WINDOW_DAYS - 1)
    );
  });

  it("uses the clamped month-end unlock date", () => {
    const w = getSurveyWindow(
      "qol_3m",
      new Date("2025-11-30T02:00:00Z"),
      noonAdelaide(2026, 3, 1),
      WINDOW
    );
    assert.deepEqual(w?.opensDate, { year: 2026, month: 2, day: 28 });
    assert.equal(w?.lastDateLabel, "29 Mar 2026");
  });
});

describe("survey window scope", () => {
  it("applies to every follow-up survey", () => {
    for (const key of FOLLOW_UP_SURVEY_TEMPLATE_KEYS) {
      assert.notEqual(getSurveyWindow(key, ENROLLMENT, ENROLLMENT), null, key);
    }
  });

  it("does not apply to 3-year imaging or Level 1 items", () => {
    for (const key of [...THREE_YEAR_IMAGING_TEMPLATE_KEYS, "qol_baseline", "post_tvus_survey"]) {
      assert.equal(getSurveyWindow(key, ENROLLMENT, ENROLLMENT), null, key);
    }
  });
});

describe("survey window test label", () => {
  it("returns the label with the configured window length when the flag is true", () => {
    assert.equal(
      surveyWindowTestLabel(true),
      `Test setting: the ${SURVEY_WINDOW_DAYS}-day window may change before launch.`
    );
    assert.equal(
      surveyWindowTestLabel(true, 45),
      "Test setting: the 45-day window may change before launch."
    );
  });

  it("returns nothing when the flag is false", () => {
    assert.equal(surveyWindowTestLabel(false), null);
  });

  it("renders the label on the card only when the flag is true", () => {
    const surveyWindow = windowOn(2026, 4, 10)!;
    const withFlag = renderToStaticMarkup(
      createElement(ChecklistSurveyWindowNote, {
        surveyWindow,
        testLabel: surveyWindowTestLabel(true),
      })
    );
    const withoutFlag = renderToStaticMarkup(
      createElement(ChecklistSurveyWindowNote, {
        surveyWindow,
        testLabel: surveyWindowTestLabel(false),
      })
    );
    assert.match(withFlag, /Open until 30 Apr 2026/);
    assert.match(withFlag, /Test setting: the \d+-day window may change before launch\./);
    assert.match(withoutFlag, /Open until 30 Apr 2026/);
    assert.doesNotMatch(withoutFlag, /Test setting/i);
  });

  it("links the closed message to the Contact page", () => {
    const html = renderToStaticMarkup(
      createElement(ChecklistSurveyWindowNote, {
        surveyWindow: windowOn(2026, 5, 1)!,
        testLabel: null,
      })
    );
    assert.match(html, /This survey closed on 30 Apr 2026\./);
    assert.match(html, /If you missed it, please/);
    assert.match(html, /href="\/dashboard\/contact"[^>]*>contact the study team<\/a>/);
  });
});
