import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getChecklistDueDisplay, PRE_TVUS_HINT_NO_DATE } from "./checklist-due-display";

/** Run these under several TZ values (e.g. TZ=UTC); results must not change. */

describe("Post-TVUS recommended due display", () => {
  it("is the Adelaide date of ultrasound completion + 7 days", () => {
    // 2 Jun 2026 00:30 Adelaide (ACST), still 1 Jun in UTC.
    const usDone = new Date("2026-06-01T15:00:00Z");
    const display = getChecklistDueDisplay({
      templateKey: "post_tvus_survey",
      completedAtByKey: new Map([["ultrasound_completed", usDone]]),
    });
    assert.equal(
      display.recommendedLabel,
      "Recommended by 9 Jun 2026 (within 7 days after ultrasound completion)"
    );
  });

  it("uses Adelaide dates across the end of daylight saving", () => {
    // 1 Apr 2026 23:30 Adelaide (ACDT); + 7 days = 8 Apr (ACST).
    const usDone = new Date("2026-04-01T13:00:00Z");
    const display = getChecklistDueDisplay({
      templateKey: "post_tvus_survey",
      completedAtByKey: new Map([["ultrasound_completed", usDone]]),
    });
    assert.match(display.recommendedLabel ?? "", /^Recommended by 8 Apr 2026 /);
  });

  it("shows guidance when ultrasound is not yet complete", () => {
    const display = getChecklistDueDisplay({
      templateKey: "post_tvus_survey",
      completedAtByKey: new Map(),
    });
    assert.equal(
      display.recommendedLabel,
      "Recommended within 7 days after you mark ultrasound complete."
    );
  });
});

describe("Pre-TVUS hint", () => {
  it("names the ultrasound date (Adelaide) when the appointment date is known", () => {
    // 12 Oct 2026 00:30 Adelaide (ACDT), still 11 Oct in UTC.
    const display = getChecklistDueDisplay({
      templateKey: "pre_tvus_survey",
      completedAtByKey: new Map(),
      ultrasoundAppointmentAt: new Date("2026-10-11T14:00:00Z"),
    });
    assert.equal(
      display.recommendedLabel,
      "Complete before your ultrasound on 12 Oct 2026"
    );
  });

  it("keeps the current text when the appointment date is unknown", () => {
    for (const ultrasoundAppointmentAt of [null, undefined]) {
      const display = getChecklistDueDisplay({
        templateKey: "pre_tvus_survey",
        completedAtByKey: new Map(),
        ultrasoundAppointmentAt,
      });
      assert.equal(display.recommendedLabel, PRE_TVUS_HINT_NO_DATE);
    }
    assert.equal(
      PRE_TVUS_HINT_NO_DATE,
      "Complete after booking ultrasound, before your ultrasound appointment."
    );
  });
});

describe("Follow-up items have no due-by display", () => {
  it("returns no due label for qol_3m", () => {
    const display = getChecklistDueDisplay({
      templateKey: "qol_3m",
      completedAtByKey: new Map(),
    });
    assert.equal(display.recommendedLabel, null);
  });
});
