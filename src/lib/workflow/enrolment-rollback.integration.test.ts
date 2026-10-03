import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { assertTestDatabase } from "@/lib/test-support/assert-test-database";
import {
  EnrolmentRegistrationError,
  registerParticipantViaToken,
} from "@/lib/enrolment/register-via-token";

assertTestDatabase();

/**
 * Real Prisma + test.db. The mock database in enrolment-security.test.ts has no
 * rollback, so it cannot show whether a failed registration gives the link back.
 * Synthetic data only; every row uses this run's unique prefix.
 */
const PREFIX = `rollback-${process.pid}-${Date.now()}`;
const email = (name: string) => `${PREFIX}-${name}@example.test`;

const SYNC_DOB = new Date(Date.UTC(2008, 3, 28));
const ENROLLMENT = new Date("2026-04-28T09:24:24.000Z");
const HOUR = 60 * 60 * 1000;

const studyRecordIds: string[] = [];

async function createEnrolment(name: string) {
  const studyRecordId = `${PREFIX}-${name}`;
  studyRecordIds.push(studyRecordId);
  await prisma.redcapParticipantSync.create({
    data: {
      studyRecordId,
      enrollmentDate: ENROLLMENT,
      dateOfBirth: SYNC_DOB,
      dataKind: "TEST",
    },
  });
  const token = await prisma.enrolmentToken.create({
    data: {
      token: `${PREFIX}-${name}-token`,
      studyRecordId,
      expiresAt: new Date(Date.now() + 24 * HOUR),
      createdBy: "integration-test",
    },
  });
  return { studyRecordId, token };
}

function register(token: string, submittedEmail: string) {
  return registerParticipantViaToken(
    token,
    {
      name: "Synthetic Participant",
      email: submittedEmail,
      password: "synthetic-password-1",
      dateOfBirth: "2008-04-28",
    },
    { db: prisma, hashPassword: async () => "synthetic-hash" }
  );
}

const rejectsWith = (code: string) => (e: unknown) =>
  e instanceof EnrolmentRegistrationError && e.code === code;

after(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.participantProfile.deleteMany({
    where: { studyRecordId: { in: studyRecordIds } },
  });
  await prisma.enrolmentToken.deleteMany({
    where: { studyRecordId: { in: studyRecordIds } },
  });
  await prisma.redcapParticipantSync.deleteMany({
    where: { studyRecordId: { in: studyRecordIds } },
  });
  await prisma.$disconnect();
});

describe("enrolment registration rolls back the token claim on failure", () => {
  it("EMAIL_EXISTS: token stays unused and no User or ParticipantProfile is created", async () => {
    const { studyRecordId, token } = await createEnrolment("email-taken");
    const taken = email("taken");
    await prisma.user.create({
      data: { email: taken, name: "Existing", role: "PARTICIPANT", passwordHash: "x" },
    });

    await assert.rejects(() => register(token.token, taken), rejectsWith("EMAIL_EXISTS"));

    const after = await prisma.enrolmentToken.findUniqueOrThrow({ where: { id: token.id } });
    assert.equal(after.usedAt, null, "token must remain usable for a retry");
    assert.equal(await prisma.user.count({ where: { email: taken } }), 1);
    assert.equal(
      await prisma.user.count({ where: { email: { startsWith: `${PREFIX}-` } } }),
      1,
      "no new User"
    );
    assert.equal(
      await prisma.participantProfile.count({ where: { studyRecordId } }),
      0,
      "no new ParticipantProfile"
    );
  });

  it("STUDY_RECORD_BOUND: token stays unused and no User is created", async () => {
    const { studyRecordId, token } = await createEnrolment("record-bound");
    const owner = await prisma.user.create({
      data: {
        email: email("owner"),
        name: "Existing owner",
        role: "PARTICIPANT",
        passwordHash: "x",
      },
    });
    await prisma.participantProfile.create({
      data: {
        userId: owner.id,
        studyRecordId,
        enrollmentDate: ENROLLMENT,
        dataSource: "REDCAP",
        dataKind: "TEST",
      },
    });
    const newcomer = email("newcomer");

    await assert.rejects(
      () => register(token.token, newcomer),
      rejectsWith("STUDY_RECORD_BOUND")
    );

    const after = await prisma.enrolmentToken.findUniqueOrThrow({ where: { id: token.id } });
    assert.equal(after.usedAt, null, "token must remain usable for a retry");
    assert.equal(await prisma.user.count({ where: { email: newcomer } }), 0, "no new User");
    assert.equal(
      await prisma.participantProfile.count({ where: { studyRecordId } }),
      1,
      "the existing profile is untouched and no second one is created"
    );
  });
});
