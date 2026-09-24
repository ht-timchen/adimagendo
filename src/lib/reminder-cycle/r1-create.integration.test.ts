import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { ReminderType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  dismissReminder,
  getReminderBannerState,
  PUSH_CLAIM_LEASE_MS,
  processDueReminders,
  respondToReminder,
} from "./process";
import { getSchoolAttendanceBannerState } from "@/lib/school-attendance-reminder/cycle";

const R1 = new Date("2026-06-05T07:00:00.000Z");
const createdUserIds: string[] = [];

async function createParticipant(): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `reminder-r1-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      role: "PARTICIPANT",
      isActive: true,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
    },
    select: { id: true },
  });
  createdUserIds.push(user.id);
  return user.id;
}

after(async () => {
  if (createdUserIds.length === 0) return;
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("R1 cycle creation on SQLite", () => {
  it("creates one cycle during the R1 window and does not create another", async () => {
    const userId = await createParticipant();
    const sends: string[] = [];
    const sendPush = async (id: string, reminderType: ReminderType) => {
      sends.push(`${id}:${reminderType}`);
      return true;
    };

    const first = await processDueReminders("school_attendance", R1, {
      onlyUserIds: [userId],
      sendPush,
    });
    const second = await processDueReminders("school_attendance", R1, {
      onlyUserIds: [userId],
      sendPush,
    });

    const rows = await prisma.reminderCycle.findMany({
      where: { userId, reminderType: "school_attendance" },
    });
    assert.equal(first.cyclesCreated, 1);
    assert.equal(second.cyclesCreated, 0);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.periodKey, "school:2026-06-05");
    assert.equal(rows[0]?.status, "pending");
    assert.ok(rows[0]?.push1SentAt);
    assert.equal(sends.length, 1);
  });

  it("does not send after the participant answers", async () => {
    const userId = await createParticipant();
    let sends = 0;
    await processDueReminders("school_attendance", R1, {
      onlyUserIds: [userId],
      sendPush: async () => false,
      afterPendingRead: async () => {
        await prisma.reminderCycle.updateMany({
          where: { userId, status: "pending" },
          data: {
            status: "completed",
            response: "YES",
            completedAt: new Date(),
          },
        });
      },
    });

    await processDueReminders("school_attendance", R1, {
      onlyUserIds: [userId],
      sendPush: async () => {
        sends += 1;
        return true;
      },
    });

    const row = await prisma.reminderCycle.findFirst({
      where: { userId, reminderType: "school_attendance" },
    });
    assert.equal(row?.status, "completed");
    assert.equal(row?.response, "YES");
    assert.equal(row?.push1SentAt, null);
    assert.equal(sends, 0);
  });

  it("sends one push when two workers claim the same stage", async () => {
    const userId = await createParticipant();
    let sends = 0;
    const sendPush = async () => {
      sends += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return true;
    };
    await Promise.all([
      processDueReminders("school_attendance", R1, {
        onlyUserIds: [userId],
        sendPush,
      }),
      processDueReminders("school_attendance", R1, {
        onlyUserIds: [userId],
        sendPush,
      }),
    ]);
    const rows = await prisma.reminderCycle.findMany({
      where: { userId, reminderType: "school_attendance" },
    });
    assert.equal(rows.length, 1);
    assert.equal(sends, 1);
    assert.ok(rows[0]?.push1SentAt);
    assert.equal(rows[0]?.push1ClaimedAt, null);
  });

  it("retries after a crash that left the lease without a successful send", async () => {
    const userId = await createParticipant();
    let sends = 0;
    await assert.rejects(
      () =>
        processDueReminders("school_attendance", R1, {
          onlyUserIds: [userId],
          sendPush: async () => {
            sends += 1;
            return true;
          },
          afterClaim: async () => {
            throw new Error("crash before send");
          },
        }),
      /crash before send/
    );

    const crashed = await prisma.reminderCycle.findFirst({
      where: { userId, reminderType: "school_attendance" },
    });
    assert.equal(sends, 0);
    assert.equal(crashed?.push1SentAt, null);
    assert.ok(crashed?.push1ClaimedAt);

    const held = await processDueReminders("school_attendance", R1, {
      onlyUserIds: [userId],
      sendPush: async () => {
        sends += 1;
        return true;
      },
    });
    const stillHeld = await prisma.reminderCycle.findFirst({
      where: { userId, reminderType: "school_attendance" },
    });
    assert.equal(held.pushesSent, 0);
    assert.equal(sends, 0);
    assert.equal(stillHeld?.push1SentAt, null);

    await prisma.reminderCycle.update({
      where: { id: crashed!.id },
      data: {
        push1ClaimedAt: new Date(Date.now() - PUSH_CLAIM_LEASE_MS - 1000),
      },
    });
    const retried = await processDueReminders("school_attendance", R1, {
      onlyUserIds: [userId],
      sendPush: async () => {
        sends += 1;
        return true;
      },
    });
    const sent = await prisma.reminderCycle.findFirst({
      where: { userId, reminderType: "school_attendance" },
    });
    assert.equal(retried.pushesSent, 1);
    assert.equal(sends, 1);
    assert.ok(sent?.push1SentAt);
    assert.equal(sent?.push1ClaimedAt, null);
  });

  it("does not log a push miss when the participant has no subscription", async () => {
    const userId = await createParticipant();
    const warnings: string[] = [];
    const infos: string[] = [];
    const warn = console.warn;
    const info = console.info;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };
    console.info = (...args: unknown[]) => {
      infos.push(args.map(String).join(" "));
    };
    try {
      await processDueReminders("school_attendance", R1, {
        onlyUserIds: [userId],
      });
      await processDueReminders(
        "school_attendance",
        new Date(R1.getTime() + 60 * 60 * 1000),
        { onlyUserIds: [userId] }
      );
    } finally {
      console.warn = warn;
      console.info = info;
    }

    const row = await prisma.reminderCycle.findFirst({
      where: { userId, reminderType: "school_attendance" },
    });
    assert.equal(row?.push1SentAt, null);
    assert.equal(
      warnings.some((line) => line.includes("push window missed")),
      false
    );
    assert.equal(
      infos.some((line) => line.includes("push skipped: no subscription")),
      true
    );
  });
});

const R3_CYCLE = {
  reminder1At: new Date("2026-06-05T07:00:00.000Z"),
  reminder2At: new Date("2026-06-06T05:30:00.000Z"),
  reminder3At: new Date("2026-06-07T05:30:00.000Z"),
  cycleEndAt: new Date("2026-06-07T14:30:00.000Z"),
};

async function insertCycle(
  userId: string,
  reminderType: "school_attendance" | "medical_appointments",
  periodKey: string
) {
  return prisma.reminderCycle.create({
    data: {
      userId,
      reminderType,
      periodKey,
      scheduleVersion: 1,
      ...R3_CYCLE,
      status: "pending",
    },
  });
}

describe("R3 banner actions on SQLite", () => {
  it("shows R3 from reminder3At until just before cycleEndAt", async () => {
    const userId = await createParticipant();
    await insertCycle(userId, "school_attendance", `school:r3-${userId}`);
    await insertCycle(userId, "medical_appointments", `medical:r3-${userId}`);
    const afterPushWindow = new Date(R3_CYCLE.reminder3At.getTime() + 60 * 60 * 1000);
    const justBeforeEnd = new Date(R3_CYCLE.cycleEndAt.getTime() - 1);

    for (const now of [R3_CYCLE.reminder3At, afterPushWindow, justBeforeEnd]) {
      assert.equal(
        (await getSchoolAttendanceBannerState(userId, now))?.stage,
        "SECOND_FOLLOWUP"
      );
      assert.equal(
        (await getReminderBannerState("medical_appointments", userId, now))?.stage,
        "SECOND_FOLLOWUP"
      );
    }
  });

  it("expires a pending cycle at cycleEndAt without moving cycleEndAt", async () => {
    const userId = await createParticipant();
    const created = await insertCycle(
      userId,
      "medical_appointments",
      `medical:end-${userId}`
    );
    await processDueReminders("medical_appointments", R3_CYCLE.cycleEndAt, {
      onlyUserIds: [userId],
    });
    const row = await prisma.reminderCycle.findUniqueOrThrow({
      where: { id: created.id },
    });
    assert.equal(row.status, "expired_missed");
    assert.equal(row.completedAt, null);
    assert.equal(row.dismissedAt, null);
    assert.equal(row.response, null);
    assert.equal(row.cycleEndAt.getTime(), R3_CYCLE.cycleEndAt.getTime());
    assert.equal(
      await getReminderBannerState(
        "medical_appointments",
        userId,
        R3_CYCLE.cycleEndAt
      ),
      null
    );
  });

  it("expires and hides R3 as soon as it is dismissed", async () => {
    const userId = await createParticipant();
    const created = await insertCycle(
      userId,
      "school_attendance",
      `school:dismiss-${userId}`
    );
    const dismissed = await dismissReminder(
      "school_attendance",
      created.id,
      userId,
      R3_CYCLE.reminder3At
    );
    const row = await prisma.reminderCycle.findUniqueOrThrow({
      where: { id: created.id },
    });
    assert.equal(dismissed, true);
    assert.equal(row.status, "expired_missed");
    assert.equal(row.dismissedAt?.getTime(), R3_CYCLE.reminder3At.getTime());
    assert.equal(row.completedAt, null);
    assert.equal(row.cycleEndAt.getTime(), R3_CYCLE.cycleEndAt.getTime());
    assert.equal(
      await getSchoolAttendanceBannerState(userId, R3_CYCLE.reminder3At),
      null
    );
  });

  it("completes and hides R3 as soon as the participant answers", async () => {
    const userId = await createParticipant();
    const yesCycle = await insertCycle(
      userId,
      "medical_appointments",
      `medical:yes-${userId}`
    );
    const noCycle = await insertCycle(
      userId,
      "school_attendance",
      `school:no-${userId}`
    );
    assert.equal(
      await respondToReminder({
        reminderType: "medical_appointments",
        cycleId: yesCycle.id,
        userId,
        action: "yes",
        now: R3_CYCLE.reminder3At,
      }),
      "YES"
    );
    assert.equal(
      await respondToReminder({
        reminderType: "school_attendance",
        cycleId: noCycle.id,
        userId,
        action: "no",
        now: R3_CYCLE.reminder3At,
      }),
      "NO"
    );

    const yes = await prisma.reminderCycle.findUniqueOrThrow({
      where: { id: yesCycle.id },
    });
    const no = await prisma.reminderCycle.findUniqueOrThrow({
      where: { id: noCycle.id },
    });
    assert.equal(yes.status, "completed");
    assert.equal(yes.response, "YES");
    assert.equal(yes.completedAt?.getTime(), R3_CYCLE.reminder3At.getTime());
    assert.equal(yes.dismissedAt, null);
    assert.equal(yes.cycleEndAt.getTime(), R3_CYCLE.cycleEndAt.getTime());
    assert.equal(no.status, "completed");
    assert.equal(no.response, "NO");
    assert.equal(no.completedAt?.getTime(), R3_CYCLE.reminder3At.getTime());
    assert.equal(no.dismissedAt, null);
    assert.equal(
      await getReminderBannerState(
        "medical_appointments",
        userId,
        R3_CYCLE.reminder3At
      ),
      null
    );
    assert.equal(
      await getSchoolAttendanceBannerState(userId, R3_CYCLE.reminder3At),
      null
    );
  });
});
