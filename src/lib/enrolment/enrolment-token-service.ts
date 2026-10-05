import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { deriveTokenStatus, type EnrolmentTokenStatus } from "@/lib/admin/participant-detail-status";

type IssueDb = Pick<PrismaClient, "$transaction" | "enrolmentToken" | "participantProfile">;
type ReadDb = Pick<PrismaClient, "enrolmentToken">;

export type IssueEnrolmentTokenResult =
  | { ok: true; token: string; studyRecordId: string; expiresAt: Date }
  | { ok: false; code: "RECORD_BOUND" };

/**
 * Issue a new enrolment link for a study record. A record that already has a linked account
 * cannot enrol again (registration would fail with STUDY_RECORD_BOUND), so no link is made and
 * the record's other links are left alone. Otherwise the previous unused, unexpired link is
 * replaced, so only one link is valid at a time.
 */
export async function issueEnrolmentToken(
  db: IssueDb,
  input: { studyRecordId: string; createdBy: string; now?: Date }
): Promise<IssueEnrolmentTokenResult> {
  const { studyRecordId, createdBy } = input;
  const now = input.now ?? new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 30);

  return db.$transaction(async (tx): Promise<IssueEnrolmentTokenResult> => {
    const bound = await tx.participantProfile.findFirst({
      where: { studyRecordId },
      select: { id: true },
    });
    if (bound) return { ok: false, code: "RECORD_BOUND" };

    await tx.enrolmentToken.deleteMany({
      where: {
        studyRecordId,
        usedAt: null,
        expiresAt: { gt: now },
      },
    });

    const token = randomBytes(32).toString("hex");
    const created = await tx.enrolmentToken.create({
      data: { token, studyRecordId, expiresAt, createdBy },
    });
    return { ok: true, token: created.token, studyRecordId: created.studyRecordId, expiresAt: created.expiresAt };
  });
}

export type EnrolmentTokenListItem = {
  id: string;
  studyRecordId: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  status: EnrolmentTokenStatus;
  /** Only present when a single study record is requested and its link is still usable. */
  token?: string;
};

/**
 * Recent tokens. The token value (the secret in the link) is included only for a still-usable
 * link and only when one study record is asked for; the overview list never carries it.
 */
export async function listEnrolmentTokens(
  db: ReadDb,
  input: { studyRecordId?: string; now?: Date }
): Promise<EnrolmentTokenListItem[]> {
  const now = input.now ?? new Date();
  const rows = await db.enrolmentToken.findMany({
    where: input.studyRecordId ? { studyRecordId: input.studyRecordId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      token: true,
      studyRecordId: true,
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });

  return rows.map((row) => {
    const status = row.revokedAt ? "expired" : deriveTokenStatus(row.usedAt, row.expiresAt, now);
    return {
      id: row.id,
      studyRecordId: row.studyRecordId,
      expiresAt: row.expiresAt.toISOString(),
      usedAt: row.usedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      status,
      ...(input.studyRecordId && status === "active" ? { token: row.token } : {}),
    };
  });
}
