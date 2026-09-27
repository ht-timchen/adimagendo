import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bookChecklistItemExternally,
  confirmChecklistAppointment,
} from "./checklist-booking-requests";
import type { StepUnavailableError } from "@/lib/workflow/assert-step-available";

type MockItem = {
  id: string;
  userId: string;
  templateId: string;
  status: string;
  bookingProgress: string;
  template: { key: string };
};

type MockState = {
  templates: { id: string; key: string; externalUrl: string | null }[];
  items: MockItem[];
  upserts: number;
};

function createMockDb(state: MockState) {
  return {
    checklistTemplate: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.templates.find((t) => t.id === where.id) ?? null,
    },
    participantChecklistItem: {
      findUnique: async ({
        where,
      }: {
        where: { userId_templateId: { userId: string; templateId: string } };
      }) =>
        state.items.find(
          (i) =>
            i.userId === where.userId_templateId.userId &&
            i.templateId === where.userId_templateId.templateId
        ) ?? null,
      upsert: async ({
        where,
      }: {
        where: { userId_templateId: { userId: string; templateId: string } };
      }) => {
        state.upserts += 1;
        const item: MockItem = {
          id: `item-${state.upserts}`,
          userId: where.userId_templateId.userId,
          templateId: where.userId_templateId.templateId,
          status: "PENDING",
          bookingProgress: "BOOKED_EXTERNALLY",
          template: { key: "unknown" },
        };
        state.items.push(item);
        return item;
      },
    },
  };
}

const NOT_YET_OPEN: StepUnavailableError = {
  error: "Step unavailable",
  reasons: ["Available from 1 Jul 2028"],
};

function baseState(): MockState {
  return {
    templates: [
      { id: "t-us3y", key: "book_ultrasound_3y", externalUrl: "https://example.test/book" },
    ],
    items: [],
    upserts: 0,
  };
}

describe("book-externally server gate", () => {
  it("returns 403 with engine reasons and does not write when the step is locked", async () => {
    const state = baseState();
    const checkedKeys: string[] = [];
    const result = await bookChecklistItemExternally(
      { userId: "u1", templateId: "t-us3y" },
      {
        db: createMockDb(state) as never,
        getBlock: async (_userId, key) => {
          checkedKeys.push(key);
          return NOT_YET_OPEN;
        },
      }
    );
    assert.equal(result.status, 403);
    assert.deepEqual(result.body, NOT_YET_OPEN);
    assert.deepEqual(checkedKeys, ["book_ultrasound_3y"]);
    assert.equal(state.upserts, 0);
  });

  it("records the booking when the step is available", async () => {
    const state = baseState();
    const result = await bookChecklistItemExternally(
      { userId: "u1", templateId: "t-us3y" },
      { db: createMockDb(state) as never, getBlock: async () => null }
    );
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { ok: true, checklistItemId: "item-1" });
    assert.equal(state.upserts, 1);
  });

  it("still rejects templates without external booking with 400", async () => {
    const state = baseState();
    state.templates[0]!.externalUrl = null;
    const result = await bookChecklistItemExternally(
      { userId: "u1", templateId: "t-us3y" },
      { db: createMockDb(state) as never, getBlock: async () => NOT_YET_OPEN }
    );
    assert.equal(result.status, 400);
  });
});

describe("confirm-appointment server gate", () => {
  function stateWithItem(status: string, bookingProgress: string): MockState {
    const state = baseState();
    state.items.push({
      id: "item-a",
      userId: "u1",
      templateId: "t-us3y",
      status,
      bookingProgress,
      template: { key: "book_ultrasound_3y" },
    });
    return state;
  }

  const params = {
    userId: "u1",
    templateId: "t-us3y",
    scheduledStartAt: "2028-08-01T00:00:00.000Z",
    scheduledLocation: "Clinic",
  };

  it("returns 403 with engine reasons and does not confirm when the step is locked", async () => {
    let confirmCalls = 0;
    const result = await confirmChecklistAppointment(params, {
      db: createMockDb(stateWithItem("PENDING", "BOOKED_EXTERNALLY")) as never,
      getBlock: async () => NOT_YET_OPEN,
      confirm: async () => {
        confirmCalls += 1;
        return { appointmentId: "a1", scheduledStartAt: params.scheduledStartAt };
      },
    });
    assert.equal(result.status, 403);
    assert.deepEqual(result.body, NOT_YET_OPEN);
    assert.equal(confirmCalls, 0);
  });

  it("confirms when the step is available", async () => {
    const result = await confirmChecklistAppointment(params, {
      db: createMockDb(stateWithItem("PENDING", "BOOKED_EXTERNALLY")) as never,
      getBlock: async () => null,
      confirm: async () => ({
        appointmentId: "a1",
        scheduledStartAt: params.scheduledStartAt,
      }),
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      ok: true,
      appointmentId: "a1",
      scheduledStartAt: params.scheduledStartAt,
    });
  });

  it("returns alreadyCompleted for confirmed items without re-checking", async () => {
    const result = await confirmChecklistAppointment(params, {
      db: createMockDb(stateWithItem("COMPLETED", "CONFIRMED")) as never,
      getBlock: async () => NOT_YET_OPEN,
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { ok: true, alreadyCompleted: true });
  });

  it("returns 404 when Book Now was not used", async () => {
    const result = await confirmChecklistAppointment(params, {
      db: createMockDb(baseState()) as never,
      getBlock: async () => null,
    });
    assert.equal(result.status, 404);
  });
});
