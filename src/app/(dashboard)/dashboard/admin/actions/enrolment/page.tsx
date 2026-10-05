import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/admin-rbac";
import { deriveTokenStatus } from "@/lib/admin/participant-detail-status";
import { deriveEnrolmentRowState, type EnrolmentRowState } from "@/lib/enrolment/enrolment-row-state";
import {
  EnrolmentClient,
  type EnrolmentTokenRow,
  type RedcapParticipantRow,
} from "./EnrolmentClient";

export default async function AdminEnrolmentPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!hasPermission(session, "enrolment:manage")) {
    redirect("/dashboard/admin");
  }

  const now = new Date();
  const rows = await prisma.enrolmentToken.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      studyRecordId: true,
      expiresAt: true,
      usedAt: true,
      createdAt: true,
    },
  });

  // The secret in each link is never sent to the browser with this list.
  const initialTokens: EnrolmentTokenRow[] = rows.map((row) => ({
    id: row.id,
    studyRecordId: row.studyRecordId,
    expiresAt: row.expiresAt.toISOString(),
    usedAt: row.usedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    status: deriveTokenStatus(row.usedAt, row.expiresAt, now),
  }));

  const redcapRows = await prisma.redcapParticipantSync.findMany({
    orderBy: { enrollmentDate: "desc" },
  });

  const redcapParticipants: RedcapParticipantRow[] = redcapRows.map((p) => ({
    id: p.id,
    studyRecordId: p.studyRecordId,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    dateOfBirth: p.dateOfBirth?.toISOString() ?? null,
    participantConsentDate: p.participantConsentDate?.toISOString() ?? null,
    parentConsentDate: p.parentConsentDate?.toISOString() ?? null,
    enrollmentDate: p.enrollmentDate?.toISOString() ?? null,
    redcapType: p.redcapType,
    consentStatus: p.consentStatus,
    createdAt: p.createdAt.toISOString(),
  }));

  // Status per participant comes from every token and the linked account of that record,
  // not from the 50 most recent tokens listed below the table.
  const studyRecordIds = redcapRows.map((p) => p.studyRecordId);
  const [profiles, recordTokens] =
    studyRecordIds.length > 0
      ? await Promise.all([
          prisma.participantProfile.findMany({
            where: { studyRecordId: { in: studyRecordIds } },
            select: { studyRecordId: true, user: { select: { isActive: true } } },
          }),
          prisma.enrolmentToken.findMany({
            where: { studyRecordId: { in: studyRecordIds } },
            select: { studyRecordId: true, usedAt: true, revokedAt: true, expiresAt: true },
          }),
        ])
      : [[], []];

  const accountByRecord = new Map(
    profiles.flatMap((p) => (p.studyRecordId ? [[p.studyRecordId, p.user] as const] : []))
  );
  const tokensByRecord = new Map<string, typeof recordTokens>();
  for (const token of recordTokens) {
    const list = tokensByRecord.get(token.studyRecordId);
    if (list) list.push(token);
    else tokensByRecord.set(token.studyRecordId, [token]);
  }
  const rowStates: Record<string, EnrolmentRowState> = Object.fromEntries(
    studyRecordIds.map((id) => [
      id,
      deriveEnrolmentRowState({
        account: accountByRecord.get(id) ?? null,
        tokens: tokensByRecord.get(id) ?? [],
        now,
      }),
    ])
  );

  return (
    <div className="mx-auto max-w-[90rem] space-y-8">
      <div>
        <Link
          href="/dashboard/admin"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          ← Back to overview
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Enrolment Links</h1>
        <p className="mt-1 text-sm text-slate-600">
          Generate magic links with QR codes for GP letters. Each link binds an app account to a
          REDCap record ID.
        </p>
      </div>

      <EnrolmentClient
        initialTokens={initialTokens}
        redcapParticipants={redcapParticipants}
        rowStates={rowStates}
      />
    </div>
  );
}
