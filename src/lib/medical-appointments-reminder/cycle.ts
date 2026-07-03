import type {
  PrismaClient,
  MedicalAppointmentsReminderCycle,
  MedicalAppointmentsReminderOutcome,
  MedicalAppointmentsReminderStage,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/push/send-to-user";
import { computeReminderDueDates } from "./intervals";
import type { MedicalAppointmentsBannerState } from "./types";
import { MEDICAL_APPOINTMENTS_DIARY_PATH } from "./types";

export type { MedicalAppointmentsBannerState } from "./types";
export { MEDICAL_APPOINTMENTS_DIARY_PATH } from "./types";

const REMINDER_PUSH_TYPE = "medical_appointments_reminder";

type MedicalAppointmentsReminderDelegate =
  PrismaClient["medicalAppointmentsReminderCycle"];

function medicalAppointmentsReminderDelegate(): MedicalAppointmentsReminderDelegate | null {
  const delegate = (
    prisma as PrismaClient & {
      medicalAppointmentsReminderCycle?: MedicalAppointmentsReminderDelegate;
    }
  ).medicalAppointmentsReminderCycle;

  if (!delegate) {
    console.warn(
      "[medical-appointments-reminder] Prisma client is missing MedicalAppointmentsReminderCycle. Run `npx prisma generate` (and `npx prisma db push` or migrate), then restart the dev server."
    );
    return null;
  }

  return delegate;
}

function resolveAwaitingCycle(
  db: MedicalAppointmentsReminderDelegate,
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
    MedicalAppointmentsReminderCycle,
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
  cycle: MedicalAppointmentsReminderCycle,
  now: Date
): boolean {
  if (cycle.outcome !== "AWAITING_RESPONSE") return false;
  if (now < dueAtForStage(cycle)) return false;
  if (cycle.dismissedAt && cycle.dismissedAt >= cycle.updatedAt) return false;
  return true;
}

async function advanceStageIfDue(
  cycle: MedicalAppointmentsReminderCycle,
  now: Date
): Promise<MedicalAppointmentsReminderCycle> {
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

  const db = medicalAppointmentsReminderDelegate();
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
): Promise<MedicalAppointmentsReminderCycle | null> {
  const db = medicalAppointmentsReminderDelegate();
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

async function ensureActiveCyclesForAllParticipants(
  now: Date
): Promise<number> {
  const db = medicalAppointmentsReminderDelegate();
  if (!db) return 0;

  const participants = await prisma.user.findMany({
    where: { role: "PARTICIPANT", isActive: true },
    select: { id: true },
  });

  let cyclesCreated = 0;

  for (const { id: userId } of participants) {
    const hadAwaiting = await db.findFirst({
      where: { userId, outcome: "AWAITING_RESPONSE" },
      select: { id: true },
    });

    const cycle = await ensureActiveCycle(userId, now);
    if (!hadAwaiting && cycle) {
      cyclesCreated += 1;
    }
  }

  return cyclesCreated;
}

async function hasReminderPushBeenSent(
  cycleId: string,
  stage: MedicalAppointmentsReminderStage
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
  stage: MedicalAppointmentsReminderStage
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
  title: "Medical Appointments Diary",
  body: "Did you have any medical appointments this month? Let us know here!",
  url: MEDICAL_APPOINTMENTS_DIARY_PATH,
} as const;

async function maybeSendReminderPush(
  cycle: MedicalAppointmentsReminderCycle,
  stage: MedicalAppointmentsReminderStage
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

export async function getMedicalAppointmentsBannerState(
  userId: string,
  now = new Date()
): Promise<MedicalAppointmentsBannerState | null> {
  let cycle = await ensureActiveCycle(userId, now);
  if (!cycle) return null;

  cycle = await advanceStageIfDue(cycle, now);

  if (!shouldShowBanner(cycle, now)) return null;

  return {
    cycleId: cycle.id,
    stage: cycle.stage,
  };
}

export async function dismissMedicalAppointmentsReminder(
  cycleId: string,
  userId: string
): Promise<void> {
  const db = medicalAppointmentsReminderDelegate();
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

export async function respondMedicalAppointmentsReminder(params: {
  cycleId: string;
  userId: string;
  action: "yes" | "no";
}): Promise<MedicalAppointmentsReminderOutcome> {
  const outcomeMap = {
    yes: "RESPONDED_YES_CONFIRMED",
    no: "RESPONDED_NO",
  } as const satisfies Record<
    typeof params.action,
    MedicalAppointmentsReminderOutcome
  >;

  const db = medicalAppointmentsReminderDelegate();
  if (!db) {
    throw new Error(
      "Medical appointments reminder is unavailable until Prisma is regenerated and the dev server is restarted"
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
  stagesAdvanced: number;
  pushesSent: number;
  cyclesCreated: number;
};

export async function processDueMedicalAppointmentsReminders(
  now = new Date()
): Promise<ProcessDueRemindersResult> {
  const db = medicalAppointmentsReminderDelegate();
  if (!db) {
    return {
      processed: 0,
      stagesAdvanced: 0,
      pushesSent: 0,
      cyclesCreated: 0,
    };
  }

  const cyclesCreated = await ensureActiveCyclesForAllParticipants(now);

  const awaiting = await db.findMany({
    where: { outcome: "AWAITING_RESPONSE" },
  });

  let stagesAdvanced = 0;
  let pushesSent = 0;

  for (const cycle of awaiting) {
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
    stagesAdvanced,
    pushesSent,
    cyclesCreated,
  };
}
