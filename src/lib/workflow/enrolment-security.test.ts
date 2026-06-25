import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST as publicRegisterPost } from "@/app/api/auth/register/route";
import { POST as importParticipantMapPost } from "@/app/api/admin/import-participant-map/route";
import { hasPermission } from "@/lib/admin-rbac";
import {
  EnrolmentRegistrationError,
  parseEnrolmentClientPayload,
  registerParticipantViaToken,
} from "@/lib/enrolment/register-via-token";
import type { ParticipantDataKind } from "@prisma/client";

const NOW = new Date("2026-06-01T12:00:00.000Z");
const FUTURE = new Date("2026-07-01T12:00:00.000Z");
const PAST = new Date("2026-05-01T12:00:00.000Z");
const ENROLLMENT = new Date("2026-04-15T00:00:00.000Z");
const SYNC_DOB = new Date("2000-01-15T00:00:00.000Z");
const VALID_DOB = "2000-01-15";

const VALID_PAYLOAD = {
  name: "Ada",
  password: "password1",
  dateOfBirth: VALID_DOB,
};

type MockToken = {
  id: string;
  token: string;
  studyRecordId: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
};

type MockSync = {
  email: string | null;
  enrollmentDate: Date | null;
  dateOfBirth: Date | null;
  dataKind: ParticipantDataKind;
};

type MockState = {
  tokens: Map<string, MockToken>;
  syncs: Map<string, MockSync>;
  profiles: Array<{ id: string; studyRecordId: string; userId: string }>;
  users: Map<string, { id: string; email: string; name: string; role: string }>;
  claimLocks: Set<string>;
};

function createMockDb(state: MockState) {
  const txClient = {
    enrolmentToken: {
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id: string;
          usedAt: null;
          revokedAt: null;
          expiresAt: { gt: Date };
        };
        data: { usedAt: Date };
      }) => {
        const token = [...state.tokens.values()].find((t) => t.id === where.id);
        if (!token) return { count: 0 };
        if (token.usedAt || token.revokedAt || token.expiresAt <= where.expiresAt.gt) {
          return { count: 0 };
        }
        if (state.claimLocks.has(token.id)) {
          return { count: 0 };
        }
        state.claimLocks.add(token.id);
        token.usedAt = data.usedAt;
        return { count: 1 };
      },
    },
    participantProfile: {
      findFirst: async ({ where }: { where: { studyRecordId: string } }) =>
        state.profiles.find((p) => p.studyRecordId === where.studyRecordId) ?? null,
      create: async ({
        data,
      }: {
        data: {
          userId: string;
          studyRecordId: string;
        };
      }) => {
        if (state.profiles.some((p) => p.studyRecordId === data.studyRecordId)) {
          throw new Error("Unique constraint failed on studyRecordId");
        }
        const profile = {
          id: `profile-${state.profiles.length + 1}`,
          studyRecordId: data.studyRecordId,
          userId: data.userId,
        };
        state.profiles.push(profile);
        return profile;
      },
    },
    user: {
      findUnique: async ({ where }: { where: { email: string } }) => {
        const email = where.email.toLowerCase();
        for (const user of state.users.values()) {
          if (user.email === email) return user;
        }
        return null;
      },
      create: async ({
        data,
      }: {
        data: { name: string; email: string; role: string };
      }) => {
        const user = {
          id: `user-${state.users.size + 1}`,
          email: data.email.toLowerCase(),
          name: data.name,
          role: data.role,
        };
        state.users.set(user.id, user);
        return user;
      },
    },
  };

  return {
    enrolmentToken: {
      findUnique: async ({ where }: { where: { token: string } }) =>
        state.tokens.get(where.token) ?? null,
    },
    redcapParticipantSync: {
      findUnique: async ({
        where,
        select,
      }: {
        where: { studyRecordId: string };
        select: {
          email?: boolean;
          enrollmentDate?: boolean;
          dateOfBirth?: boolean;
          dataKind?: boolean;
        };
      }) => {
        const sync = state.syncs.get(where.studyRecordId);
        if (!sync) return null;
        const row: Record<string, unknown> = {};
        if (select.email) row.email = sync.email;
        if (select.enrollmentDate) row.enrollmentDate = sync.enrollmentDate;
        if (select.dateOfBirth) row.dateOfBirth = sync.dateOfBirth;
        if (select.dataKind) row.dataKind = sync.dataKind;
        return row;
      },
    },
    participantProfile: txClient.participantProfile,
    user: txClient.user,
    $transaction: async (fn: (tx: typeof txClient) => Promise<void>) => fn(txClient),
  };
}

function seedValidEnrolment(state: MockState, tokenValue = "valid-token") {
  const token: MockToken = {
    id: "token-1",
    token: tokenValue,
    studyRecordId: "REC-001",
    expiresAt: FUTURE,
    usedAt: null,
    revokedAt: null,
  };
  state.tokens.set(tokenValue, token);
  state.syncs.set("REC-001", {
    email: "participant@example.com",
    enrollmentDate: ENROLLMENT,
    dateOfBirth: SYNC_DOB,
    dataKind: "UNKNOWN",
  });
  return token;
}

describe("enrolment security", () => {
  it("rejects public signup API with 404", async () => {
    const res = await publicRegisterPost();
    assert.equal(res.status, 404);
  });

  it("rejects CSV participant import with 403", async () => {
    const res = await importParticipantMapPost();
    assert.equal(res.status, 403);
  });

  it("rejects client-submitted email", () => {
    assert.throws(
      () =>
        parseEnrolmentClientPayload({
          email: "evil@example.com",
          ...VALID_PAYLOAD,
        }),
      (e: unknown) =>
        e instanceof EnrolmentRegistrationError && e.code === "FORBIDDEN_FIELDS"
    );
  });

  it("rejects client-submitted role", () => {
    assert.throws(
      () =>
        parseEnrolmentClientPayload({
          role: "ADMIN",
          ...VALID_PAYLOAD,
        }),
      (e: unknown) =>
        e instanceof EnrolmentRegistrationError && e.code === "FORBIDDEN_FIELDS"
    );
  });

  it("rejects client-submitted studyRecordId", () => {
    assert.throws(
      () =>
        parseEnrolmentClientPayload({
          studyRecordId: "REC-999",
          ...VALID_PAYLOAD,
        }),
      (e: unknown) =>
        e instanceof EnrolmentRegistrationError && e.code === "FORBIDDEN_FIELDS"
    );
  });

  it("rejects forged token", async () => {
    const state: MockState = {
      tokens: new Map(),
      syncs: new Map(),
      profiles: [],
      users: new Map(),
      claimLocks: new Set(),
    };
    await assert.rejects(
      () =>
        registerParticipantViaToken(
          "missing-token",
          VALID_PAYLOAD,
          {
            db: createMockDb(state) as never,
            now: NOW,
            hashPassword: async () => "hash",
            resolveEnrollmentDate: async () => ENROLLMENT,
          }
        ),
      (e: unknown) =>
        e instanceof EnrolmentRegistrationError && e.code === "INVALID_TOKEN"
    );
  });

  it("rejects expired token", async () => {
    const state: MockState = {
      tokens: new Map(),
      syncs: new Map(),
      profiles: [],
      users: new Map(),
      claimLocks: new Set(),
    };
    state.tokens.set("expired", {
      id: "token-exp",
      token: "expired",
      studyRecordId: "REC-001",
      expiresAt: PAST,
      usedAt: null,
      revokedAt: null,
    });
    state.syncs.set("REC-001", {
      email: "participant@example.com",
      enrollmentDate: ENROLLMENT,
      dateOfBirth: SYNC_DOB,
      dataKind: "UNKNOWN",
    });

    await assert.rejects(
      () =>
        registerParticipantViaToken(
          "expired",
          VALID_PAYLOAD,
          {
            db: createMockDb(state) as never,
            now: NOW,
            hashPassword: async () => "hash",
            resolveEnrollmentDate: async () => ENROLLMENT,
          }
        ),
      (e: unknown) =>
        e instanceof EnrolmentRegistrationError && e.code === "TOKEN_EXPIRED"
    );
  });

  it("rejects used token", async () => {
    const state: MockState = {
      tokens: new Map(),
      syncs: new Map(),
      profiles: [],
      users: new Map(),
      claimLocks: new Set(),
    };
    state.tokens.set("used", {
      id: "token-used",
      token: "used",
      studyRecordId: "REC-001",
      expiresAt: FUTURE,
      usedAt: NOW,
      revokedAt: null,
    });
    state.syncs.set("REC-001", {
      email: "participant@example.com",
      enrollmentDate: ENROLLMENT,
      dateOfBirth: SYNC_DOB,
      dataKind: "UNKNOWN",
    });

    await assert.rejects(
      () =>
        registerParticipantViaToken(
          "used",
          VALID_PAYLOAD,
          {
            db: createMockDb(state) as never,
            now: NOW,
            hashPassword: async () => "hash",
            resolveEnrollmentDate: async () => ENROLLMENT,
          }
        ),
      (e: unknown) =>
        e instanceof EnrolmentRegistrationError && e.code === "TOKEN_USED"
    );
  });

  it("rejects revoked token", async () => {
    const state: MockState = {
      tokens: new Map(),
      syncs: new Map(),
      profiles: [],
      users: new Map(),
      claimLocks: new Set(),
    };
    state.tokens.set("revoked", {
      id: "token-revoked",
      token: "revoked",
      studyRecordId: "REC-001",
      expiresAt: FUTURE,
      usedAt: null,
      revokedAt: NOW,
    });
    state.syncs.set("REC-001", {
      email: "participant@example.com",
      enrollmentDate: ENROLLMENT,
      dateOfBirth: SYNC_DOB,
      dataKind: "UNKNOWN",
    });

    await assert.rejects(
      () =>
        registerParticipantViaToken(
          "revoked",
          VALID_PAYLOAD,
          {
            db: createMockDb(state) as never,
            now: NOW,
            hashPassword: async () => "hash",
            resolveEnrollmentDate: async () => ENROLLMENT,
          }
        ),
      (e: unknown) =>
        e instanceof EnrolmentRegistrationError && e.code === "TOKEN_REVOKED"
    );
  });

  it("registers with server-side email from REDCap sync", async () => {
    const state: MockState = {
      tokens: new Map(),
      syncs: new Map(),
      profiles: [],
      users: new Map(),
      claimLocks: new Set(),
    };
    seedValidEnrolment(state);

    const result = await registerParticipantViaToken(
      "valid-token",
      { name: "Ada Lovelace", password: "password1", dateOfBirth: VALID_DOB },
      {
        db: createMockDb(state) as never,
        now: NOW,
        hashPassword: async () => "hash",
        resolveEnrollmentDate: async () => ENROLLMENT,
      }
    );

    assert.equal(result.email, "participant@example.com");
    assert.equal(state.users.size, 1);
    assert.equal([...state.users.values()][0]?.role, "PARTICIPANT");
    assert.equal(state.profiles.length, 1);
    assert.equal(state.profiles[0]?.studyRecordId, "REC-001");
    assert.ok(state.tokens.get("valid-token")?.usedAt);
  });

  it("rejects binding the same studyRecordId twice", async () => {
    const state: MockState = {
      tokens: new Map(),
      syncs: new Map(),
      profiles: [{ id: "p1", studyRecordId: "REC-001", userId: "u1" }],
      users: new Map(),
      claimLocks: new Set(),
    };
    seedValidEnrolment(state, "second-token");

    await assert.rejects(
      () =>
        registerParticipantViaToken(
          "second-token",
          VALID_PAYLOAD,
          {
            db: createMockDb(state) as never,
            now: NOW,
            hashPassword: async () => "hash",
            resolveEnrollmentDate: async () => ENROLLMENT,
          }
        ),
      (e: unknown) =>
        e instanceof EnrolmentRegistrationError && e.code === "STUDY_RECORD_BOUND"
    );
  });

  it("rejects reusing a token after successful registration", async () => {
    const state: MockState = {
      tokens: new Map(),
      syncs: new Map(),
      profiles: [],
      users: new Map(),
      claimLocks: new Set(),
    };
    seedValidEnrolment(state);
    const opts = {
      db: createMockDb(state) as never,
      now: NOW,
      hashPassword: async () => "hash",
      resolveEnrollmentDate: async () => ENROLLMENT,
    };

    await registerParticipantViaToken(
      "valid-token",
      { name: "First", password: "password1", dateOfBirth: VALID_DOB },
      opts
    );

    await assert.rejects(
      () =>
        registerParticipantViaToken(
          "valid-token",
          { name: "Second", password: "password1", dateOfBirth: VALID_DOB },
          opts
        ),
      (e: unknown) =>
        e instanceof EnrolmentRegistrationError && e.code === "TOKEN_USED"
    );
  });

  it("rejects concurrent token claim when updateMany loses the race", async () => {
    const state: MockState = {
      tokens: new Map(),
      syncs: new Map(),
      profiles: [],
      users: new Map(),
      claimLocks: new Set(),
    };
    seedValidEnrolment(state);

    const db = createMockDb(state);
    db.$transaction = async (fn) => {
      const tx = {
        enrolmentToken: {
          updateMany: async () => ({ count: 0 }),
        },
        participantProfile: db.participantProfile,
        user: db.user,
      };
      return fn(tx as never);
    };

    await assert.rejects(
      () =>
        registerParticipantViaToken(
          "valid-token",
          { name: "Race", password: "password1", dateOfBirth: VALID_DOB },
          {
            db: db as never,
            now: NOW,
            hashPassword: async () => "hash",
            resolveEnrollmentDate: async () => ENROLLMENT,
          }
        ),
      (e: unknown) =>
        e instanceof EnrolmentRegistrationError && e.code === "TOKEN_RACE_LOST"
    );
  });

  it("rejects missing date of birth in payload", () => {
    assert.throws(
      () =>
        parseEnrolmentClientPayload({
          name: "Ada",
          password: "password1",
        }),
      (e: unknown) =>
        e instanceof EnrolmentRegistrationError && e.code === "DOB_MISSING"
    );
  });

  it("rejects date of birth mismatch without consuming token", async () => {
    const state: MockState = {
      tokens: new Map(),
      syncs: new Map(),
      profiles: [],
      users: new Map(),
      claimLocks: new Set(),
    };
    seedValidEnrolment(state);
    const opts = {
      db: createMockDb(state) as never,
      now: NOW,
      hashPassword: async () => "hash",
      resolveEnrollmentDate: async () => ENROLLMENT,
    };

    await assert.rejects(
      () =>
        registerParticipantViaToken(
          "valid-token",
          { name: "Ada", password: "password1", dateOfBirth: "1999-12-31" },
          opts
        ),
      (e: unknown) =>
        e instanceof EnrolmentRegistrationError && e.code === "DOB_MISMATCH"
    );

    assert.equal(state.tokens.get("valid-token")?.usedAt, null);
    assert.equal(state.users.size, 0);
  });

  it("rejects registration when sync date of birth is missing", async () => {
    const state: MockState = {
      tokens: new Map(),
      syncs: new Map(),
      profiles: [],
      users: new Map(),
      claimLocks: new Set(),
    };
    seedValidEnrolment(state);
    const sync = state.syncs.get("REC-001");
    if (sync) sync.dateOfBirth = null;

    await assert.rejects(
      () =>
        registerParticipantViaToken("valid-token", VALID_PAYLOAD, {
          db: createMockDb(state) as never,
          now: NOW,
          hashPassword: async () => "hash",
          resolveEnrollmentDate: async () => ENROLLMENT,
        }),
      (e: unknown) =>
        e instanceof EnrolmentRegistrationError && e.code === "SYNC_DOB_MISSING"
    );

    assert.equal(state.tokens.get("valid-token")?.usedAt, null);
  });

  it("denies participant role from admin permissions", () => {
    const session = {
      user: { id: "p1", role: "PARTICIPANT", email: "p@example.com" },
    } as never;
    assert.equal(hasPermission(session, "participant:read"), false);
    assert.equal(hasPermission(session, "overview:read"), false);
  });

  it("allows existing credential login rules to accept valid password hash", async () => {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("correct-horse", 4);
    const ok = await bcrypt.compare("correct-horse", hash);
    assert.equal(ok, true);
    const bad = await bcrypt.compare("wrong-password", hash);
    assert.equal(bad, false);
  });
});
