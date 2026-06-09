import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-api-auth";
import {
  assertValidParticipantClassification,
  getRedcapSyncDataKind,
  resolveRedcapProfileClassification,
} from "@/lib/participant/participant-data-classification";
import { getRedcapConsentEnrollmentDate } from "@/lib/checklist/resolve-enrollment-date";
import { resolveAutomaticParticipantClassification } from "@/lib/participant/preserve-pilot-classification";

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === "," && !inQuotes) || c === "\t") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out.map((s) => s.replace(/^"|"$/g, ""));
}

function detectColumns(header: string[]): { emailIdx: number; recordIdx: number } | null {
  const lower = header.map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const emailIdx = lower.findIndex((h) => h === "email" || h === "participant_email" || h === "e_mail");
  const recordIdx = lower.findIndex(
    (h) =>
      h === "record_id" ||
      h === "study_record_id" ||
      h === "studyrecordid" ||
      h === "redcap_record_id" ||
      h === "recordid"
  );
  if (emailIdx < 0 || recordIdx < 0) return null;
  return { emailIdx, recordIdx };
}

export async function POST(req: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ct = req.headers.get("content-type") ?? "";
  let text = "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }
    text = await file.text();
  } else if (ct.includes("text/csv") || ct.includes("text/plain")) {
    text = await req.text();
  } else {
    return NextResponse.json({ error: "Expected multipart/form-data with file or text/csv body" }, { status: 400 });
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV must include a header row and at least one data row" }, { status: 400 });
  }

  const header = parseCsvLine(lines[0]);
  const cols = detectColumns(header);
  if (!cols) {
    return NextResponse.json(
      {
        error:
          "Header must include email and record_id columns (e.g. email,record_id or participant_email,study_record_id)",
      },
      { status: 400 }
    );
  }

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const email = (row[cols.emailIdx] ?? "").toLowerCase().trim();
    const recordId = (row[cols.recordIdx] ?? "").trim();
    if (!email || !recordId) {
      skipped += 1;
      continue;
    }
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        role: true,
        profile: { select: { id: true, dataSource: true, dataKind: true } },
      },
    });
    if (!user || user.role !== "PARTICIPANT") {
      skipped += 1;
      errors.push(`Row ${i + 1}: no participant for ${email}`);
      continue;
    }
    try {
      const syncDataKind = await getRedcapSyncDataKind(prisma, recordId);
      const classification = resolveAutomaticParticipantClassification(
        user.profile,
        resolveRedcapProfileClassification(syncDataKind)
      );
      assertValidParticipantClassification(
        classification.dataSource,
        classification.dataKind
      );

      if (user.profile) {
        await prisma.participantProfile.update({
          where: { userId: user.id },
          data: {
            studyRecordId: recordId,
            ...classification,
          },
        });
      } else {
        const consentEnrollmentDate = await getRedcapConsentEnrollmentDate(recordId);
        if (!consentEnrollmentDate) {
          throw new Error(
            `No REDCap consent date for record ${recordId}; sync REDCap before linking new participants.`
          );
        }
        await prisma.participantProfile.create({
          data: {
            userId: user.id,
            enrollmentDate: consentEnrollmentDate,
            studyRecordId: recordId,
            studyPhase: "baseline",
            ...classification,
          },
        });
      }
      updated += 1;
    } catch (e) {
      skipped += 1;
      errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : "update failed"}`);
    }
  }

  return NextResponse.json({
    ok: true,
    updated,
    skipped,
    errors: errors.slice(0, 20),
  });
}
