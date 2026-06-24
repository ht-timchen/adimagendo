import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/admin-api-auth";
import { displayStudyRecordId } from "@/lib/admin-display";
import { ADMIN_AUDIT_ACTIONS, recordAdminAuditEvent } from "@/lib/admin-audit";

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET() {
  const session = await requirePermission("symptom_diary:export");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const entries = await prisma.symptomEntry.findMany({
    orderBy: [{ date: "desc" }, { userId: "asc" }],
    include: {
      user: {
        select: {
          email: true,
          name: true,
          profile: { select: { studyRecordId: true } },
        },
      },
    },
  });

  const header = [
    "record_id",
    "participant_email",
    "participant_name",
    "symptom_date",
    "pain_level",
    "symptoms_json",
    "notes",
    "synced_to_redcap",
    "synced_at",
  ];

  const lines = [header.join(",")];
  for (const e of entries) {
    const recordId = displayStudyRecordId(e.user.profile, e.userId);
    const symptoms =
      typeof e.symptoms === "string" ? e.symptoms : JSON.stringify(e.symptoms ?? null);
    const row = [
      csvEscape(recordId),
      csvEscape(e.user.email),
      csvEscape(e.user.name ?? ""),
      csvEscape(e.date.toISOString()),
      e.painLevel != null ? String(e.painLevel) : "",
      csvEscape(symptoms),
      csvEscape(e.notes ?? ""),
      e.syncedToRedcap ? "1" : "0",
      e.syncedAt ? csvEscape(e.syncedAt.toISOString()) : "",
    ];
    lines.push(row.join(","));
  }

  const body = lines.join("\r\n");
  const filename = `symptom-diary-export-${new Date().toISOString().slice(0, 10)}.csv`;

  await recordAdminAuditEvent({
    session,
    action: ADMIN_AUDIT_ACTIONS.SYMPTOM_DIARY_EXPORTED,
    targetType: "export",
    targetName: filename,
    metadata: { rowCount: entries.length },
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
