/** Push is enabled when the participant has at least one stored subscription. */

export type ParticipantPushStore = {
  pushSubscription: {
    count(args: { where: { userId: string } }): Promise<number>;
    deleteMany(args: {
      where: { userId: string };
    }): Promise<{ count: number }>;
    upsert(args: {
      where: { endpoint: string };
      create: {
        endpoint: string;
        p256dh: string;
        auth: string;
        userId: string;
      };
      update: {
        p256dh: string;
        auth: string;
        userId: string;
      };
    }): Promise<unknown>;
  };
};

export function participantCanEnablePush(isActive: boolean): boolean {
  return isActive;
}

/**
 * Called when a participant becomes inactive.
 * Deletes stored subscriptions only when at least one exists.
 */
export async function disableParticipantPushIfEnabled(
  db: ParticipantPushStore,
  userId: string
): Promise<void> {
  const enabled = await db.pushSubscription.count({ where: { userId } });
  if (enabled === 0) return;
  await db.pushSubscription.deleteMany({ where: { userId } });
}

/** Already-inactive deactivate: drop leftover subscriptions, then keep the 400. */
export async function rejectAlreadyInactiveParticipant(
  db: ParticipantPushStore,
  userId: string
): Promise<{ status: 400; error: "Participant is already inactive" }> {
  await disableParticipantPushIfEnabled(db, userId);
  return { status: 400, error: "Participant is already inactive" };
}

export async function enableParticipantPush(
  db: ParticipantPushStore,
  input: {
    userId: string;
    isActive: boolean;
    endpoint: string;
    p256dh: string;
    auth: string;
  }
): Promise<{ ok: true } | { ok: false; status: 403; error: string }> {
  if (!participantCanEnablePush(input.isActive)) {
    return {
      ok: false,
      status: 403,
      error: "Push notifications are disabled for this account",
    };
  }

  await db.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userId: input.userId,
    },
    update: {
      p256dh: input.p256dh,
      auth: input.auth,
      userId: input.userId,
    },
  });

  return { ok: true };
}
