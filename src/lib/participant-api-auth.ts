import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdminDashboardRole } from "@/lib/admin-rbac";

export type ParticipantApiSession = {
  session: Session;
  userId: string;
  studyRecordId: string;
};

export type ParticipantApiAuthResult =
  | { ok: true; ctx: ParticipantApiSession }
  | { ok: false; response: NextResponse };

export function evaluateParticipantApiAccess(input: {
  userId?: string | null;
  role?: string | null;
  isAdmin: boolean;
  studyRecordId?: string | null;
  /** Current database User.isActive. Session active is not authoritative. */
  isActive?: boolean | null;
}): 401 | 403 | "ok" {
  if (!input.userId) return 401;
  if (input.isAdmin || input.role !== "PARTICIPANT") return 403;
  if (input.isActive !== true) return 403;
  if (!input.studyRecordId?.trim()) return 403;
  return "ok";
}

export async function requireParticipantApiSession(): Promise<ParticipantApiAuthResult> {
  const session = await auth();
  const userId = session?.user?.id;

  const profile = userId
    ? await prisma.participantProfile.findUnique({
        where: { userId },
        select: {
          studyRecordId: true,
          user: { select: { isActive: true } },
        },
      })
    : null;

  const decision = evaluateParticipantApiAccess({
    userId,
    role: session?.user?.role,
    isAdmin: session ? isAdminDashboardRole(session) : false,
    studyRecordId: profile?.studyRecordId,
    isActive: profile?.user.isActive,
  });

  if (decision === 401) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (decision === 403) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    ctx: {
      session: session!,
      userId: session!.user!.id!,
      studyRecordId: profile!.studyRecordId!.trim(),
    },
  };
}
