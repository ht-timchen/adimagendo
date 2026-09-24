import type { ReminderCycle, ReminderType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendPushToUser, type PushPayload } from "@/lib/push/send-to-user";
import { openMedicalCycle, openSchoolCycle, type OpenReminderCycle } from "./open-cycle";
import {
  deriveStage,
  dismissAction,
  dueAtForStage,
  isBannerVisible,
  isWithinPushWindow,
  mayCreateCycle,
  type ReminderCycleView,
  type ReminderStage,
} from "./visibility";

const PUSH_COPY: Record<ReminderType, PushPayload> = {
  school_attendance: {
    title: "School Attendance Diary",
    body: "Did you miss school at any point this week? Let us know here!",
    url: "/dashboard",
  },
  medical_appointments: {
    title: "Medical Appointments Diary",
    body: "Did you have any medical appointments this month? Let us know here!",
    url: "/dashboard",
  },
};

const loggedPushMisses = new Set<string>();
const loggedPushSkips = new Set<string>();

export class ReminderNotAvailableError extends Error {
  constructor() {
    super("Reminder is not available");
    this.name = "ReminderNotAvailableError";
  }
}

export type ReminderBannerState = {
  cycleId: string;
  stage: "INITIAL" | "FIRST_FOLLOWUP" | "SECOND_FOLLOWUP";
};

export type ProcessDueRemindersResult = {
  processed: number;
  cyclesCreated: number;
  pushesSent: number;
  expired: number;
};

/** A crashed worker's claim can be taken after this. Sends are expected to finish sooner. */
export const PUSH_CLAIM_LEASE_MS = 5 * 60 * 1000;

export type ProcessDueRemindersOptions = {
  onlyUserIds?: string[];
  sendPush?: (userId: string, reminderType: ReminderType) => Promise<boolean>;
  afterPendingRead?: () => Promise<void>;
  /** Runs after the lease is taken and before send. A throw leaves the lease and does not set pushXSentAt. */
  afterClaim?: () => Promise<void>;
};

function asView(cycle: ReminderCycle): ReminderCycleView {
  return {
    reminder1At: cycle.reminder1At,
    reminder2At: cycle.reminder2At,
    reminder3At: cycle.reminder3At,
    cycleEndAt: cycle.cycleEndAt,
    status: cycle.status,
    dismissedAt: cycle.dismissedAt,
  };
}

function bannerStage(
  stage: ReminderStage
): ReminderBannerState["stage"] {
  if (stage === 1) return "INITIAL";
  if (stage === 2) return "FIRST_FOLLOWUP";
  return "SECOND_FOLLOWUP";
}

function pushSentAt(cycle: ReminderCycle, stage: ReminderStage): Date | null {
  if (stage === 1) return cycle.push1SentAt;
  if (stage === 2) return cycle.push2SentAt;
  return cycle.push3SentAt;
}

function openCycle(type: ReminderType, now: Date): OpenReminderCycle | null {
  return type === "school_attendance" ? openSchoolCycle(now) : openMedicalCycle(now);
}

export async function getReminderBannerState(
  reminderType: ReminderType,
  userId: string,
  now = new Date()
): Promise<ReminderBannerState | null> {
  const cycle = await prisma.reminderCycle.findFirst({
    where: {
      userId,
      reminderType,
      status: "pending",
      reminder1At: { lte: now },
      cycleEndAt: { gt: now },
    },
    orderBy: { reminder1At: "desc" },
  });
  if (!cycle || !isBannerVisible(asView(cycle), now)) return null;
  const stage = deriveStage(cycle, now);
  if (stage == null) return null;
  return { cycleId: cycle.id, stage: bannerStage(stage) };
}

export async function dismissReminder(
  reminderType: ReminderType,
  cycleId: string,
  userId: string,
  now = new Date()
): Promise<boolean> {
  const cycle = await prisma.reminderCycle.findFirst({
    where: { id: cycleId, userId, reminderType },
  });
  if (!cycle) return false;
  const action = dismissAction(asView(cycle), now);
  if (action === "reject") return false;

  const updated = await prisma.reminderCycle.updateMany({
    where: { id: cycle.id, status: "pending" },
    data:
      action === "expire"
        ? { status: "expired_missed", dismissedAt: now }
        : { dismissedAt: now },
  });
  return updated.count === 1;
}

export async function respondToReminder(params: {
  reminderType: ReminderType;
  cycleId: string;
  userId: string;
  action: "yes" | "no";
  now?: Date;
}): Promise<"YES" | "NO"> {
  const now = params.now ?? new Date();
  const cycle = await prisma.reminderCycle.findFirst({
    where: {
      id: params.cycleId,
      userId: params.userId,
      reminderType: params.reminderType,
    },
  });
  if (!cycle || !isBannerVisible(asView(cycle), now)) {
    throw new ReminderNotAvailableError();
  }

  const response = params.action === "yes" ? "YES" : "NO";
  const updated = await prisma.reminderCycle.updateMany({
    where: { id: cycle.id, status: "pending" },
    data: {
      status: "completed",
      response,
      completedAt: now,
    },
  });
  if (updated.count !== 1) throw new ReminderNotAvailableError();
  return response;
}

function logPushMiss(cycleId: string, stage: ReminderStage): void {
  const key = `${cycleId}:${stage}`;
  if (loggedPushMisses.has(key)) return;
  loggedPushMisses.add(key);
  console.warn("[reminder-cycle] push window missed without a successful send", {
    cycleId,
    stage,
  });
}

function logPushSkipped(cycleId: string, stage: ReminderStage): void {
  const key = `${cycleId}:${stage}`;
  if (loggedPushSkips.has(key)) return;
  loggedPushSkips.add(key);
  console.info("[reminder-cycle] push skipped: no subscription", {
    cycleId,
    stage,
  });
}

async function userIdsWithSubscription(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true },
    distinct: ["userId"],
  });
  return new Set(rows.map((row) => row.userId));
}

async function sendStagePush(
  userId: string,
  reminderType: ReminderType,
  logContext: { cycleId: string; stage: ReminderStage }
): Promise<boolean> {
  const subscriptions = await prisma.pushSubscription.count({
    where: { userId },
  });
  if (subscriptions === 0) {
    logPushSkipped(logContext.cycleId, logContext.stage);
    return false;
  }
  try {
    const result = await sendPushToUser(userId, PUSH_COPY[reminderType]);
    return result.sent > 0;
  } catch (error) {
    console.error("[reminder-cycle] push failed", error);
    return false;
  }
}

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

async function claimStage(
  cycleId: string,
  stage: ReminderStage,
  claimAt: Date
): Promise<boolean> {
  const staleBefore = new Date(claimAt.getTime() - PUSH_CLAIM_LEASE_MS);
  const pending = { id: cycleId, status: "pending" as const };
  const claimed =
    stage === 1
      ? await prisma.reminderCycle.updateMany({
          where: {
            ...pending,
            push1SentAt: null,
            OR: [
              { push1ClaimedAt: null },
              { push1ClaimedAt: { lt: staleBefore } },
            ],
          },
          data: { push1ClaimedAt: claimAt },
        })
      : stage === 2
        ? await prisma.reminderCycle.updateMany({
            where: {
              ...pending,
              push2SentAt: null,
              OR: [
                { push2ClaimedAt: null },
                { push2ClaimedAt: { lt: staleBefore } },
              ],
            },
            data: { push2ClaimedAt: claimAt },
          })
        : await prisma.reminderCycle.updateMany({
            where: {
              ...pending,
              push3SentAt: null,
              OR: [
                { push3ClaimedAt: null },
                { push3ClaimedAt: { lt: staleBefore } },
              ],
            },
            data: { push3ClaimedAt: claimAt },
          });
  return claimed.count === 1;
}

async function releaseStageClaim(
  cycleId: string,
  stage: ReminderStage,
  claimAt: Date
): Promise<void> {
  if (stage === 1) {
    await prisma.reminderCycle.updateMany({
      where: { id: cycleId, push1ClaimedAt: claimAt, push1SentAt: null },
      data: { push1ClaimedAt: null },
    });
    return;
  }
  if (stage === 2) {
    await prisma.reminderCycle.updateMany({
      where: { id: cycleId, push2ClaimedAt: claimAt, push2SentAt: null },
      data: { push2ClaimedAt: null },
    });
    return;
  }
  await prisma.reminderCycle.updateMany({
    where: { id: cycleId, push3ClaimedAt: claimAt, push3SentAt: null },
    data: { push3ClaimedAt: null },
  });
}

async function recordSuccessfulSend(
  cycleId: string,
  stage: ReminderStage,
  claimAt: Date,
  sentAt: Date
): Promise<boolean> {
  const finished =
    stage === 1
      ? await prisma.reminderCycle.updateMany({
          where: { id: cycleId, push1ClaimedAt: claimAt, push1SentAt: null },
          data: { push1SentAt: sentAt, push1ClaimedAt: null },
        })
      : stage === 2
        ? await prisma.reminderCycle.updateMany({
            where: { id: cycleId, push2ClaimedAt: claimAt, push2SentAt: null },
            data: { push2SentAt: sentAt, push2ClaimedAt: null },
          })
        : await prisma.reminderCycle.updateMany({
            where: { id: cycleId, push3ClaimedAt: claimAt, push3SentAt: null },
            data: { push3SentAt: sentAt, push3ClaimedAt: null },
          });
  return finished.count === 1;
}

async function claimAndSendStage(input: {
  cycleId: string;
  userId: string;
  reminderType: ReminderType;
  stage: ReminderStage;
  sendPush: (userId: string, reminderType: ReminderType) => Promise<boolean>;
  afterClaim?: () => Promise<void>;
}): Promise<boolean> {
  const claimAt = new Date();
  const claimed = await claimStage(input.cycleId, input.stage, claimAt);
  if (!claimed) return false;

  const fresh = await prisma.reminderCycle.findFirst({
    where: { id: input.cycleId },
    select: { status: true },
  });
  if (fresh?.status !== "pending") {
    await releaseStageClaim(input.cycleId, input.stage, claimAt);
    return false;
  }

  if (input.afterClaim) await input.afterClaim();

  let sent = false;
  try {
    sent = await input.sendPush(input.userId, input.reminderType);
  } catch (error) {
    console.error("[reminder-cycle] push failed", error);
    sent = false;
  }

  if (!sent) {
    await releaseStageClaim(input.cycleId, input.stage, claimAt);
    return false;
  }

  return recordSuccessfulSend(
    input.cycleId,
    input.stage,
    claimAt,
    new Date()
  );
}

export async function processDueReminders(
  reminderType: ReminderType,
  now = new Date(),
  options: ProcessDueRemindersOptions = {}
): Promise<ProcessDueRemindersResult> {
  const opening = openCycle(reminderType, now);
  let cyclesCreated = 0;

  if (opening) {
    const participants = await prisma.user.findMany({
      where: {
        role: "PARTICIPANT",
        isActive: true,
        createdAt: { lte: opening.reminder1At },
        ...(options.onlyUserIds ? { id: { in: options.onlyUserIds } } : {}),
      },
      select: { id: true, createdAt: true, isActive: true },
    });
    const data = participants
      .filter((participant) =>
        mayCreateCycle({
          now,
          reminder1At: opening.reminder1At,
          registeredAt: participant.createdAt,
          isActive: participant.isActive,
        })
      )
      .map((participant) => ({
        userId: participant.id,
        reminderType,
        periodKey: opening.periodKey,
        scheduleVersion: opening.scheduleVersion,
        reminder1At: opening.reminder1At,
        reminder2At: opening.reminder2At,
        reminder3At: opening.reminder3At,
        cycleEndAt: opening.cycleEndAt,
      }));
    const existing = await prisma.reminderCycle.findMany({
      where: {
        reminderType,
        periodKey: opening.periodKey,
        userId: { in: data.map((row) => row.userId) },
      },
      select: { userId: true },
    });
    const alreadyCreated = new Set(existing.map((row) => row.userId));
    for (const row of data) {
      if (alreadyCreated.has(row.userId)) continue;
      try {
        await prisma.reminderCycle.create({ data: row });
        cyclesCreated += 1;
      } catch (error) {
        if (!isUniqueConflict(error)) throw error;
      }
    }
  }

  const pending = await prisma.reminderCycle.findMany({
    where: {
      reminderType,
      status: "pending",
      ...(options.onlyUserIds ? { userId: { in: options.onlyUserIds } } : {}),
    },
  });
  if (options.afterPendingRead) await options.afterPendingRead();
  const userIds = [...new Set(pending.map((cycle) => cycle.userId))];
  const users =
    userIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, isActive: true, role: true },
        });
  const userById = new Map(users.map((user) => [user.id, user]));
  const subscribedUserIds = await userIdsWithSubscription(userIds);

  let pushesSent = 0;
  let expired = 0;

  for (const cycle of pending) {
    for (const stage of [1, 2, 3] as const) {
      const due = dueAtForStage(cycle, stage);
      if (pushSentAt(cycle, stage)) continue;
      if (now.getTime() >= due.getTime() + 60 * 60 * 1000) {
        if (!subscribedUserIds.has(cycle.userId)) {
          logPushSkipped(cycle.id, stage);
          continue;
        }
        logPushMiss(cycle.id, stage);
      }
    }

    if (now >= cycle.cycleEndAt) {
      const updated = await prisma.reminderCycle.updateMany({
        where: { id: cycle.id, status: "pending" },
        data: { status: "expired_missed" },
      });
      expired += updated.count;
      continue;
    }

    const user = userById.get(cycle.userId);
    const canPush = user?.role === "PARTICIPANT" && user.isActive === true;

    for (const stage of [1, 2, 3] as const) {
      const due = dueAtForStage(cycle, stage);
      if (pushSentAt(cycle, stage) || !isWithinPushWindow(due, now) || !canPush) {
        continue;
      }
      const sent = await claimAndSendStage({
        cycleId: cycle.id,
        userId: cycle.userId,
        reminderType,
        stage,
        sendPush:
          options.sendPush ??
          ((id, type) =>
            sendStagePush(id, type, { cycleId: cycle.id, stage })),
        afterClaim: options.afterClaim,
      });
      if (sent) pushesSent += 1;
    }
  }

  return {
    processed: pending.length,
    cyclesCreated,
    pushesSent,
    expired,
  };
}
