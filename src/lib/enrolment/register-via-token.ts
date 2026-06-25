import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { resolveParticipantEnrollmentDate } from "@/lib/checklist/resolve-enrollment-date";
import { prisma } from "@/lib/db";
import {
  assertValidParticipantClassification,
  getRedcapSyncDataKind,
  resolveRedcapProfileClassification,
} from "@/lib/participant/participant-data-classification";

export type EnrolmentRegistrationErrorCode =
  | "INVALID_BODY"
  | "FORBIDDEN_FIELDS"
  | "INVALID_TOKEN"
  | "TOKEN_USED"
  | "TOKEN_EXPIRED"
  | "TOKEN_REVOKED"
  | "SYNC_NOT_ELIGIBLE"
  | "SYNC_EMAIL_MISSING"
  | "EMAIL_EXISTS"
  | "STUDY_RECORD_BOUND"
  | "TOKEN_RACE_LOST"
  | "MISSING_FIELDS"
  | "DOB_MISSING"
  | "DOB_MISMATCH"
  | "SYNC_DOB_MISSING";

const DOB_INPUT_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Compare calendar date (UTC) without exposing stored value to clients. */
export function datesMatchCalendarDay(stored: Date, submittedYmd: string): boolean {
  const [y, m, d] = submittedYmd.split("-").map(Number);
  return (
    stored.getUTCFullYear() === y &&
    stored.getUTCMonth() === m - 1 &&
    stored.getUTCDate() === d
  );
}

function parseSubmittedDateOfBirth(value: unknown): string {
  if (typeof value !== "string" || !DOB_INPUT_RE.test(value.trim())) {
    throw new EnrolmentRegistrationError(
      "DOB_MISSING",
      "Date of birth is required.",
      400
    );
  }
  const ymd = value.trim();
  const [y, m, d] = ymd.split("-").map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    throw new EnrolmentRegistrationError(
      "DOB_MISSING",
      "Date of birth is required.",
      400
    );
  }
  return ymd;
}

export class EnrolmentRegistrationError extends Error {
  readonly code: EnrolmentRegistrationErrorCode;
  readonly httpStatus: number;

  constructor(code: EnrolmentRegistrationErrorCode, message: string, httpStatus: number) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type ParsedEnrolmentClientPayload = {
  name: string;
  email: string;
  password: string;
  dateOfBirth: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseSubmittedEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new EnrolmentRegistrationError(
      "MISSING_FIELDS",
      "A valid email address is required.",
      400
    );
  }
  const email = value.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    throw new EnrolmentRegistrationError(
      "MISSING_FIELDS",
      "A valid email address is required.",
      400
    );
  }
  return email;
}

/** Reject client-supplied studyRecordId or role. */
export function parseEnrolmentClientPayload(body: unknown): ParsedEnrolmentClientPayload {
  if (!body || typeof body !== "object") {
    throw new EnrolmentRegistrationError("INVALID_BODY", "Invalid request body.", 400);
  }

  const record = body as Record<string, unknown>;
  if ("studyRecordId" in record) {
    throw new EnrolmentRegistrationError(
      "FORBIDDEN_FIELDS",
      "Study record ID cannot be submitted by the client.",
      403
    );
  }
  if ("role" in record) {
    throw new EnrolmentRegistrationError(
      "FORBIDDEN_FIELDS",
      "Role cannot be submitted by the client.",
      403
    );
  }

  const name = typeof record.name === "string" ? record.name.trim() : "";
  const email = parseSubmittedEmail(record.email);
  const password = typeof record.password === "string" ? record.password : "";
  const dateOfBirth = parseSubmittedDateOfBirth(record.dateOfBirth);

  if (!name || !password) {
    throw new EnrolmentRegistrationError(
      "MISSING_FIELDS",
      "Name and password are required.",
      400
    );
  }
  if (password.length < 8) {
    throw new EnrolmentRegistrationError(
      "MISSING_FIELDS",
      "Password must be at least 8 characters.",
      400
    );
  }

  return { name, email, password, dateOfBirth };
}

type RegisterParticipantDb = Pick<
  PrismaClient,
  "$transaction" | "enrolmentToken" | "redcapParticipantSync" | "participantProfile" | "user"
>;

export async function registerParticipantViaToken(
  token: string,
  payload: ParsedEnrolmentClientPayload,
  options?: {
    now?: Date;
    hashPassword?: (password: string) => Promise<string>;
    db?: RegisterParticipantDb;
    resolveEnrollmentDate?: (studyRecordId: string) => Promise<Date | null>;
  }
): Promise<{ email: string }> {
  const db = options?.db ?? prisma;
  const now = options?.now ?? new Date();
  const hashPassword = options?.hashPassword ?? ((password: string) => bcrypt.hash(password, 12));
  const resolveEnrollmentDate =
    options?.resolveEnrollmentDate ?? resolveParticipantEnrollmentDate;

  const enrolment = await db.enrolmentToken.findUnique({
    where: { token },
  });

  if (!enrolment) {
    throw new EnrolmentRegistrationError("INVALID_TOKEN", "Invalid link.", 400);
  }
  if (enrolment.revokedAt) {
    throw new EnrolmentRegistrationError("TOKEN_REVOKED", "This link has been revoked.", 400);
  }
  if (enrolment.usedAt) {
    throw new EnrolmentRegistrationError("TOKEN_USED", "This link has already been used.", 400);
  }
  if (enrolment.expiresAt < now) {
    throw new EnrolmentRegistrationError("TOKEN_EXPIRED", "This link has expired.", 400);
  }

  const sync = await db.redcapParticipantSync.findUnique({
    where: { studyRecordId: enrolment.studyRecordId },
    select: { enrollmentDate: true, dateOfBirth: true },
  });

  if (!sync?.enrollmentDate) {
    throw new EnrolmentRegistrationError(
      "SYNC_NOT_ELIGIBLE",
      "REDCap consent date is not available for this record yet.",
      400
    );
  }

  if (!sync.dateOfBirth) {
    throw new EnrolmentRegistrationError(
      "SYNC_DOB_MISSING",
      "Date of birth is not on file for this study record. Please contact your study coordinator.",
      400
    );
  }

  if (!datesMatchCalendarDay(sync.dateOfBirth, payload.dateOfBirth)) {
    throw new EnrolmentRegistrationError(
      "DOB_MISMATCH",
      "The date of birth you entered does not match our records. Please try again.",
      400
    );
  }

  const email = payload.email;

  const enrollmentDate = await resolveEnrollmentDate(enrolment.studyRecordId);
  if (!enrollmentDate) {
    throw new EnrolmentRegistrationError(
      "SYNC_NOT_ELIGIBLE",
      "REDCap consent date is not available for this record yet.",
      400
    );
  }

  const syncDataKind = await getRedcapSyncDataKind(db, enrolment.studyRecordId);
  const classification = resolveRedcapProfileClassification(syncDataKind);
  assertValidParticipantClassification(classification.dataSource, classification.dataKind);

  const passwordHash = await hashPassword(payload.password);

  await db.$transaction(async (tx) => {
    const claimed = await tx.enrolmentToken.updateMany({
      where: {
        id: enrolment.id,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) {
      throw new EnrolmentRegistrationError(
        "TOKEN_RACE_LOST",
        "This link is no longer available.",
        400
      );
    }

    const boundProfile = await tx.participantProfile.findFirst({
      where: { studyRecordId: enrolment.studyRecordId },
      select: { id: true },
    });
    if (boundProfile) {
      throw new EnrolmentRegistrationError(
        "STUDY_RECORD_BOUND",
        "This study record is already linked to an account.",
        400
      );
    }

    const existingUser = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      throw new EnrolmentRegistrationError(
        "EMAIL_EXISTS",
        "An account with this email already exists.",
        400
      );
    }

    const user = await tx.user.create({
      data: {
        name: payload.name,
        email,
        passwordHash,
        role: "PARTICIPANT",
        isActive: true,
      },
    });

    await tx.participantProfile.create({
      data: {
        userId: user.id,
        studyRecordId: enrolment.studyRecordId,
        enrollmentDate,
        studyPhase: "baseline",
        ...classification,
      },
    });
  });

  return { email };
}
