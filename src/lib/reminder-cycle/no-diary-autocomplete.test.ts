import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));

describe("reminder cycles stay decoupled from diaries", () => {
  it("does not auto-complete a cycle from a diary entry", () => {
    for (const file of [
      "src/lib/reminder-cycle/process.ts",
      "src/lib/school-attendance-reminder/cycle.ts",
      "src/lib/medical-appointments-reminder/cycle.ts",
    ]) {
      const source = readFileSync(`${root}${file}`, "utf8");
      assert.equal(source.includes("hasAbsenceEntry"), false, file);
      assert.equal(source.includes("completeCycleFromDiary"), false, file);
    }
  });
});
