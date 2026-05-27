import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { EnrolmentClient, type EnrolmentTokenRow } from "./EnrolmentClient";

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

  return (
    <div className="mx-auto max-w-3xl space-y-8">
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

      <EnrolmentClient initialTokens={initialTokens} />
    </div>
  );
}
