import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveStage,
  dismissAction,
  isBannerVisible,
  isWithinPushWindow,
  mayCreateCycle,
  type ReminderCycleView,
} from "./visibility";

function cycle(overrides: Partial<ReminderCycleView> = {}): ReminderCycleView {
  return {
    reminder1At: new Date("2026-06-05T07:00:00.000Z"),
    reminder2At: new Date("2026-06-06T05:30:00.000Z"),
    reminder3At: new Date("2026-06-07T05:30:00.000Z"),
    cycleEndAt: new Date("2026-06-07T14:30:00.000Z"),
    status: "pending",
    dismissedAt: null,
    ...overrides,
  };
}

describe("reminder cycle visibility", () => {
  it("shows R1 only from reminder1 until R2", () => {
    const row = cycle();
    assert.equal(isBannerVisible(row, new Date("2026-06-05T06:59:00.000Z")), false);
    assert.equal(isBannerVisible(row, row.reminder1At), true);
    assert.equal(
      isBannerVisible(row, new Date(row.reminder2At.getTime() - 1)),
      true
    );
    assert.equal(isBannerVisible(row, row.reminder2At), true);
  });

  it("hides a stage after dismiss and shows the next stage", () => {
    const dismissedAt = new Date("2026-06-05T08:00:00.000Z");
    const row = cycle({ dismissedAt });
    assert.equal(isBannerVisible(row, dismissedAt), false);
    assert.equal(isBannerVisible(row, row.reminder2At), true);
    assert.equal(
      dismissAction(row, row.reminder2At),
      "hide_stage"
    );
  });

  it("expires on R3 dismiss and rejects Yes/No when the banner is hidden", () => {
    const row = cycle();
    assert.equal(dismissAction(row, row.reminder3At), "expire");
    assert.equal(dismissAction(row, row.reminder1At), "hide_stage");
    const hidden = cycle({
      dismissedAt: new Date("2026-06-05T08:00:00.000Z"),
    });
    assert.equal(dismissAction(hidden, hidden.dismissedAt!), "reject");
    assert.equal(isBannerVisible(hidden, hidden.dismissedAt!), false);
  });

  it("keeps R3 visible from reminder3At until just before cycleEndAt", () => {
    const row = cycle();
    const afterPushWindow = new Date(row.reminder3At.getTime() + 60 * 60 * 1000);
    const justBeforeEnd = new Date(row.cycleEndAt.getTime() - 1);

    assert.ok(afterPushWindow < row.cycleEndAt);
    assert.equal(deriveStage(row, new Date(row.reminder3At.getTime() - 1)), 2);
    assert.equal(deriveStage(row, row.reminder3At), 3);
    assert.equal(isBannerVisible(row, row.reminder3At), true);
    assert.equal(deriveStage(row, afterPushWindow), 3);
    assert.equal(isBannerVisible(row, afterPushWindow), true);
    assert.equal(deriveStage(row, justBeforeEnd), 3);
    assert.equal(isBannerVisible(row, justBeforeEnd), true);
  });

  it("hides R2 after dismiss and shows R3 when reminder3At arrives", () => {
    const dismissedAt = new Date("2026-06-06T06:00:00.000Z");
    const row = cycle({ dismissedAt });
    assert.equal(dismissAction(cycle(), row.reminder2At), "hide_stage");
    assert.equal(isBannerVisible(row, dismissedAt), false);
    assert.equal(
      isBannerVisible(row, new Date(row.reminder3At.getTime() - 1)),
      false
    );
    assert.equal(isBannerVisible(row, row.reminder3At), true);
  });

  it("hides the banner at cycle end and after a response", () => {
    const row = cycle();
    assert.equal(isBannerVisible(row, new Date(row.cycleEndAt.getTime() - 1)), true);
    assert.equal(isBannerVisible(row, row.cycleEndAt), false);
    assert.equal(
      isBannerVisible(cycle({ status: "completed" }), row.reminder1At),
      false
    );
  });

  it("keeps the push window to the hour after the stage instant", () => {
    const due = new Date("2026-06-05T07:00:00.000Z");
    assert.equal(isWithinPushWindow(due, due), true);
    assert.equal(
      isWithinPushWindow(due, new Date(due.getTime() + 60 * 60 * 1000 - 1)),
      true
    );
    assert.equal(
      isWithinPushWindow(due, new Date(due.getTime() + 60 * 60 * 1000)),
      false
    );
  });

  it("creates a cycle only for an active participant registered by R1, inside the R1 window", () => {
    const reminder1At = new Date("2026-06-05T07:00:00.000Z");
    const inside = new Date("2026-06-05T07:15:00.000Z");
    assert.equal(
      mayCreateCycle({
        now: inside,
        reminder1At,
        registeredAt: reminder1At,
        isActive: true,
      }),
      true
    );
    assert.equal(
      mayCreateCycle({
        now: inside,
        reminder1At,
        registeredAt: new Date(reminder1At.getTime() + 1),
        isActive: true,
      }),
      false
    );
    assert.equal(
      mayCreateCycle({
        now: inside,
        reminder1At,
        registeredAt: new Date(reminder1At.getTime() - 1),
        isActive: false,
      }),
      false
    );
    assert.equal(
      mayCreateCycle({
        now: new Date(reminder1At.getTime() + 60 * 60 * 1000),
        reminder1At,
        registeredAt: new Date("2026-06-01T00:00:00.000Z"),
        isActive: true,
      }),
      false
    );
  });
});
