import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  disableParticipantPushIfEnabled,
  enableParticipantPush,
  rejectAlreadyInactiveParticipant,
  type ParticipantPushStore,
} from "./participant-push-access";

type Subscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userId: string;
};

function memoryStore(initial: Subscription[] = []): ParticipantPushStore & {
  subscriptions: Subscription[];
  deleteCalls: number;
} {
  const subscriptions = [...initial];
  let deleteCalls = 0;
  const store = {
    get subscriptions() {
      return subscriptions;
    },
    get deleteCalls() {
      return deleteCalls;
    },
    pushSubscription: {
      async count(args: { where: { userId: string } }) {
        return subscriptions.filter((row) => row.userId === args.where.userId)
          .length;
      },
      async deleteMany(args: { where: { userId: string } }) {
        deleteCalls += 1;
        const before = subscriptions.length;
        for (let i = subscriptions.length - 1; i >= 0; i -= 1) {
          if (subscriptions[i]?.userId === args.where.userId) {
            subscriptions.splice(i, 1);
          }
        }
        return { count: before - subscriptions.length };
      },
      async upsert(args: {
        where: { endpoint: string };
        create: Subscription;
        update: Pick<Subscription, "p256dh" | "auth" | "userId">;
      }) {
        const existing = subscriptions.find(
          (row) => row.endpoint === args.where.endpoint
        );
        if (existing) {
          existing.p256dh = args.update.p256dh;
          existing.auth = args.update.auth;
          existing.userId = args.update.userId;
          return existing;
        }
        subscriptions.push({ ...args.create });
        return args.create;
      },
    },
  };
  return store;
}

const SUBSCRIPTION = {
  endpoint: "https://push.example/device-1",
  p256dh: "p256dh-key",
  auth: "auth-key",
};

describe("inactive participant push access", () => {
  it("leaves push enabled for an active participant", async () => {
    const db = memoryStore();
    const result = await enableParticipantPush(db, {
      userId: "participant-1",
      isActive: true,
      ...SUBSCRIPTION,
    });

    assert.equal(result.ok, true);
    assert.equal(db.subscriptions.length, 1);
    assert.equal(db.subscriptions[0]?.userId, "participant-1");
    assert.equal(db.deleteCalls, 0);
  });

  it("disables push when an active participant becomes inactive", async () => {
    const db = memoryStore([
      { userId: "participant-1", ...SUBSCRIPTION },
    ]);
    let isActive = true;

    isActive = false;
    assert.equal(isActive, false);
    await disableParticipantPushIfEnabled(db, "participant-1");

    assert.equal(db.subscriptions.length, 0);
    assert.equal(db.deleteCalls, 1);
  });

  it("does nothing when push is already disabled", async () => {
    const db = memoryStore();

    await disableParticipantPushIfEnabled(db, "participant-1");

    assert.equal(db.subscriptions.length, 0);
    assert.equal(db.deleteCalls, 0);
  });

  it("removes a leftover subscription when deactivate is repeated", async () => {
    const db = memoryStore([
      { userId: "participant-1", ...SUBSCRIPTION },
    ]);

    const rejected = await rejectAlreadyInactiveParticipant(db, "participant-1");

    assert.equal(rejected.status, 400);
    assert.equal(rejected.error, "Participant is already inactive");
    assert.equal(db.subscriptions.length, 0);
    assert.equal(db.deleteCalls, 1);
  });

  it("rejects a new subscription while the participant is inactive", async () => {
    const db = memoryStore();
    const result = await enableParticipantPush(db, {
      userId: "participant-1",
      isActive: false,
      ...SUBSCRIPTION,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 403);
    }
    assert.equal(db.subscriptions.length, 0);
    assert.equal(db.deleteCalls, 0);
  });
});
