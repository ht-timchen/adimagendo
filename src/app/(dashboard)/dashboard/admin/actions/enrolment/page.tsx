import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/admin-rbac";
import {
  EnrolmentClient,
  type EnrolmentTokenRow,
  type RedcapParticipantRow,
} from "./EnrolmentClient";

function deriveTokenStatus(usedAt: Date | null, expiresAt: Date): EnrolmentTokenRow["status"] {
  if (usedAt) return "used";
  if (expiresAt < new Date()) return "expired";
  return "active";
}

export default async function AdminEnrolmentPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!hasPermission(session, "enrolment:manage")) {
    redirect("/dashboard/admin");
  }

  const rows = await prisma.enrolmentToken.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      token: true,
      studyRecordId: true,
      expiresAt: true,
      usedAt: true,
      createdAt: true,
    },
  });

  const initialTokens: EnrolmentTokenRow[] = rows.map((row) => ({
    id: row.id,
    token: row.token,
    studyRecordId: row.studyRecordId,
    expiresAt: row.expiresAt.toISOString(),
    usedAt: row.usedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    status: deriveTokenStatus(row.usedAt, row.expiresAt),
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

  const studyRecordIds = redcapRows.map((p) => p.studyRecordId);
  const boundProfiles =
    studyRecordIds.length > 0
      ? await prisma.participantProfile.findMany({
          where: { studyRecordId: { in: studyRecordIds } },
          select: { studyRecordId: true },
        })
      : [];
  const boundStudyRecordIds = boundProfiles
    .map((p) => p.studyRecordId)
    .filter((id): id is string => id != null);

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
        boundStudyRecordIds={boundStudyRecordIds}
      />
    </div>
  );
}
