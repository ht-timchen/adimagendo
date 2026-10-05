import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-api-auth";
import { ADMIN_AUDIT_ACTIONS, recordAdminAuditEvent } from "@/lib/admin-audit";
import { prisma } from "@/lib/db";
import { issueEnrolmentToken, listEnrolmentTokens } from "@/lib/enrolment/enrolment-token-service";

export async function GET(req: Request) {
  const session = await requirePermission("enrolment:manage");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const studyRecordId = new URL(req.url).searchParams.get("studyRecordId")?.trim() || undefined;
  const tokens = await listEnrolmentTokens(prisma, { studyRecordId });

  // Handing out the secret link is recorded. The record only says the link was retrieved:
  // it never contains the link or token, and it does not mean the link reached the participant.
  if (studyRecordId && tokens.some((t) => t.token)) {
    await recordAdminAuditEvent({
      session,
      action: ADMIN_AUDIT_ACTIONS.ENROLMENT_LINK_RETRIEVED,
      targetType: "participant",
      targetId: studyRecordId,
      metadata: { studyRecordId },
    });
  }

  return NextResponse.json(tokens);
}

export async function POST(req: Request) {
  const session = await requirePermission("enrolment:manage");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const studyRecordId =
    typeof body === "object" &&
    body !== null &&
    "studyRecordId" in body &&
    typeof (body as { studyRecordId: unknown }).studyRecordId === "string"
      ? (body as { studyRecordId: string }).studyRecordId.trim()
      : "";

  if (!studyRecordId) {
    return NextResponse.json({ error: "studyRecordId is required" }, { status: 400 });
  }

  const result = await issueEnrolmentToken(prisma, { studyRecordId, createdBy: session.user.id });
  if (!result.ok) {
    return NextResponse.json(
      {
        error: "This participant has already registered, so a new enrolment link can't be created.",
        code: result.code,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    token: result.token,
    studyRecordId: result.studyRecordId,
    expiresAt: result.expiresAt.toISOString(),
  });
}
