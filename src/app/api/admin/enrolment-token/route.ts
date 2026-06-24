import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/db";

function deriveTokenStatus(usedAt: Date | null, expiresAt: Date): "used" | "expired" | "active" {
  if (usedAt) return "used";
  if (expiresAt < new Date()) return "expired";
  return "active";
}

function serializeToken(row: {
  id: string;
  token: string;
  studyRecordId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    token: row.token,
    studyRecordId: row.studyRecordId,
    expiresAt: row.expiresAt.toISOString(),
    usedAt: row.usedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    status: deriveTokenStatus(row.usedAt, row.expiresAt),
  };
}

export async function GET(req: Request) {
  const session = await requirePermission("enrolment:manage");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const studyRecordId = new URL(req.url).searchParams.get("studyRecordId")?.trim();

  const tokens = await prisma.enrolmentToken.findMany({
    where: studyRecordId ? { studyRecordId } : undefined,
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

  return NextResponse.json(tokens.map(serializeToken));
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

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 30);

  await prisma.enrolmentToken.deleteMany({
    where: {
      studyRecordId,
      usedAt: null,
      expiresAt: { gt: now },
    },
  });

  const token = randomBytes(32).toString("hex");

  const created = await prisma.enrolmentToken.create({
    data: {
      token,
      studyRecordId,
      expiresAt,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json({
    token: created.token,
    studyRecordId: created.studyRecordId,
    expiresAt: created.expiresAt.toISOString(),
  });
}
