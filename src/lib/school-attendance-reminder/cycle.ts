import type {
  PrismaClient,
  SchoolAttendanceReminderCycle,
  SchoolAttendanceReminderOutcome,
  SchoolAttendanceReminderStage,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/push/send-to-user";
import { hasAbsenceEntryForCurrentWeek } from "./absence-check";
import { computeReminderDueDates } from "./intervals";
import type { SchoolAttendanceBannerState } from "./types";

export type { SchoolAttendanceBannerState } from "./types";
export { SCHOOL_ATTENDANCE_DIARY_PATH } from "./types";

const REMINDER_PUSH_TYPE = "school_attendance_reminder";

type SchoolAttendanceReminderDelegate = PrismaClient["schoolAttendanceReminderCycle"];

function schoolAttendanceReminderDelegate(): SchoolAttendanceReminderDelegate | null {
  const delegate = (
    prisma as PrismaClient & {
      schoolAttendanceReminderCycle?: SchoolAttendanceReminderDelegate;
    }
  ).schoolAttendanceReminderCycle;

  if (!delegate) {
    console.warn(
      "[school-attendance-reminder] Prisma client is missing SchoolAttendanceReminderCycle. Run `npx prisma generate` (and `npx prisma db push` or migrate), then restart the dev server."
    );
    return null;
  }

  return delegate;
}

function resolveAwaitingCycle(
  db: SchoolAttendanceReminderDelegate,
  userId: string,
  cycleId: string
) {
  return db
    .findFirst({
      where: { id: cycleId, userId, outcome: "AWAITING_RESPONSE" },
    })
    .then(
      (cycle) =>
        cycle ??
        db.findFirst({
          where: { userId, outcome: "AWAITING_RESPONSE" },
          orderBy: { cycleStartAt: "desc" },
        })
    );
}

function dueAtForStage(
  cycle: Pick<
    SchoolAttendanceReminderCycle,
    "stage" | "initialDueAt" | "firstFollowUpDueAt" | "secondFollowUpDueAt"
  >
): Date {
  switch (cycle.stage) {
    case "FIRST_FOLLOWUP":
      return cycle.firstFollowUpDueAt;
    case "SECOND_FOLLOWUP":
      return cycle.secondFollowUpDueAt;
    default:
      return cycle.initialDueAt;
  }
}

function shouldShowBanner(
  cycle: SchoolAttendanceReminderCycle,
  now: Date
): boolean {
  if (cycle.outcome !== "AWAITING_RESPONSE") return false;
  if (now < dueAtForStage(cycle)) return false;
  if (cycle.dismissedAt && cycle.dismissedAt >= cycle.updatedAt) return false;
  return true;
}

async function advanceStageIfDue(
  cycle: SchoolAttendanceReminderCycle,
  now: Date
): Promise<SchoolAttendanceReminderCycle> {
  if (cycle.outcome !== "AWAITING_RESPONSE") return cycle;

  let nextStage = cycle.stage;

  if (
    now >= cycle.secondFollowUpDueAt &&
    cycle.stage !== "SECOND_FOLLOWUP"
  ) {
    nextStage = "SECOND_FOLLOWUP";
  } else if (
    now >= cycle.firstFollowUpDueAt &&
    cycle.stage === "INITIAL"
  ) {
    nextStage = "FIRST_FOLLOWUP";
  }

  if (nextStage === cycle.stage) return cycle;

  const db = schoolAttendanceReminderDelegate();
  if (!db) return cycle;

  return db.update({
    where: { id: cycle.id },
    data: {
      stage: nextStage,
      dismissedAt: null,
    },
  });
}

async function ensureActiveCycle(
  userId: string,
  now: Date
): Promise<SchoolAttendanceReminderCycle | null> {
  const db = schoolAttendanceReminderDelegate();
  if (!db) return null;

  const awaiting = await db.findFirst({
    where: { userId, outcome: "AWAITING_RESPONSE" },
    orderBy: { cycleStartAt: "desc" },
  });
  if (awaiting) return awaiting;

  const cycleStartAt = now;
  const dueDates = computeReminderDueDates(cycleStartAt);

  return db.create({
    data: {
      userId,
      cycleStartAt,
      ...dueDates,
    },
  });
}

async function completeCycleFromDiaryEntry(
  cycleId: string
): Promise<void> {
  const db = schoolAttendanceReminderDelegate();
  if (!db) return;

  await db.update({
    where: { id: cycleId },
    data: {
      outcome: "RESPONDED_YES_CONFIRMED",
      respondedAt: new Date(),
      dismissedAt: null,
    },
  });
}

async function hasReminderPushBeenSent(
  cycleId: string,
  stage: SchoolAttendanceReminderStage
): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: {
      type: REMINDER_PUSH_TYPE,
      title: cycleId,
      body: stage,
    },
    select: { id: true },
  });
  return existing != null;
}

async function recordReminderPushSent(
  userId: string,
  cycleId: string,
  stage: SchoolAttendanceReminderStage
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type: REMINDER_PUSH_TYPE,
      title: cycleId,
      body: stage,
      read: false,
    },
  });
}

const PUSH_COPY = {
  title: "School Attendance Diary",
  body: "Did you miss school at any point this week? Let us know here!",
  url: "/dashboard",
} as const;

async function maybeSendReminderPush(
  cycle: SchoolAttendanceReminderCycle,
  stage: SchoolAttendanceReminderStage
): Promise<boolean> {
  if (await hasReminderPushBeenSent(cycle.id, stage)) {
    return false;
  }

  const subscriptionCount = await prisma.pushSubscription.count({
    where: { userId: cycle.userId },
  });

  if (subscriptionCount > 0) {
    await sendPushToUser(cycle.userId, PUSH_COPY);
  }

  await recordReminderPushSent(cycle.userId, cycle.id, stage);
  return true;
}

export async function getSchoolAttendanceBannerState(
  userId: string,
  now = new Date()
): Promise<SchoolAttendanceBannerState | null> {
  let cycle = await ensureActiveCycle(userId, now);
  if (!cycle) return null;

  cycle = await advanceStageIfDue(cycle, now);

  if (!shouldShowBanner(cycle, now)) return null;

  return {
    cycleId: cycle.id,
    stage: cycle.stage,
  };
}

export async function dismissSchoolAttendanceReminder(
  cycleId: string,
  userId: string
): Promise<void> {
  const db = schoolAttendanceReminderDelegate();
  if (!db) return;

  const cycle = await resolveAwaitingCycle(db, userId, cycleId);
  if (!cycle) return;

  if (cycle.stage === "SECOND_FOLLOWUP") {
    await db.update({
      where: { id: cycle.id },
      data: {
        outcome: "EXPIRED_NO_RESPONSE",
        dismissedAt: new Date(),
      },
    });
    return;
  }

  await db.update({
    where: { id: cycle.id },
    data: { dismissedAt: new Date() },
  });
}

export async function respondSchoolAttendanceReminder(params: {
  cycleId: string;
  userId: string;
  action: "yes" | "no";
}): Promise<SchoolAttendanceReminderOutcome> {
  const outcomeMap = {
    yes: "RESPONDED_YES_CONFIRMED",
    no: "RESPONDED_NO",
  } as const satisfies Record<
    typeof params.action,
    SchoolAttendanceReminderOutcome
  >;

  const db = schoolAttendanceReminderDelegate();
  if (!db) {
    throw new Error(
      "School attendance reminder is unavailable until Prisma is regenerated and the dev server is restarted"
    );
  }

  const cycle = await resolveAwaitingCycle(db, params.userId, params.cycleId);
  if (!cycle) {
    throw new Error("Reminder cycle not found or already completed");
  }

  await db.update({
    where: { id: cycle.id },
    data: {
      outcome: outcomeMap[params.action],
      respondedAt: new Date(),
      dismissedAt: null,
    },
  });

  return outcomeMap[params.action];
}

export type ProcessDueRemindersResult = {
  processed: number;
  completedFromDiary: number;
  stagesAdvanced: number;
  pushesSent: number;
};

export async function processDueSchoolAttendanceReminders(
  now = new Date()
): Promise<ProcessDueRemindersResult> {
  const db = schoolAttendanceReminderDelegate();
  if (!db) {
    return {
      processed: 0,
      completedFromDiary: 0,
      stagesAdvanced: 0,
      pushesSent: 0,
    };
  }

  const awaiting = await db.findMany({
    where: { outcome: "AWAITING_RESPONSE" },
  });

  let completedFromDiary = 0;
  let stagesAdvanced = 0;
  let pushesSent = 0;

  for (const cycle of awaiting) {
    if (now >= cycle.firstFollowUpDueAt) {
      const hasDiaryEntry = await hasAbsenceEntryForCurrentWeek(
        cycle.userId,
        now
      );
      if (hasDiaryEntry) {
        await completeCycleFromDiaryEntry(cycle.id);
        completedFromDiary += 1;
        continue;
      }
    }

    let current = cycle;

    if (
      now >= current.secondFollowUpDueAt &&
      current.stage !== "SECOND_FOLLOWUP"
    ) {
      current = await db.update({
        where: { id: current.id },
        data: { stage: "SECOND_FOLLOWUP", dismissedAt: null },
      });
      stagesAdvanced += 1;
    } else if (
      now >= current.firstFollowUpDueAt &&
      current.stage === "INITIAL"
    ) {
      current = await db.update({
        where: { id: current.id },
        data: { stage: "FIRST_FOLLOWUP", dismissedAt: null },
      });
      stagesAdvanced += 1;
    }

    if (now >= current.initialDueAt) {
      if (await maybeSendReminderPush(current, "INITIAL")) {
        pushesSent += 1;
      }
    }

    if (
      current.stage === "FIRST_FOLLOWUP" &&
      now >= current.firstFollowUpDueAt
    ) {
      if (await maybeSendReminderPush(current, "FIRST_FOLLOWUP")) {
        pushesSent += 1;
      }
    }

    if (
      current.stage === "SECOND_FOLLOWUP" &&
      now >= current.secondFollowUpDueAt
    ) {
      if (await maybeSendReminderPush(current, "SECOND_FOLLOWUP")) {
        pushesSent += 1;
      }
    }
  }

  return {
    processed: awaiting.length,
    completedFromDiary,
    stagesAdvanced,
    pushesSent,
  };
}
