import { NextResponse } from "next/server";
import { requireParticipantApiSession } from "@/lib/participant-api-auth";
import { z } from "zod";
import {
  dismissSchoolAttendanceReminder,
  respondSchoolAttendanceReminder,
} from "@/lib/school-attendance-reminder/cycle";

const RespondSchema = z.object({
  cycleId: z.string().min(1),
  action: z.enum(["yes", "no"]),
});

const DismissSchema = z.object({
  cycleId: z.string().min(1),
});

export async function POST(req: Request) {
  const authResult = await requireParticipantApiSession();
  if (!authResult.ok) return authResult.response;
  const { userId } = authResult.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RespondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const outcome = await respondSchoolAttendanceReminder({
      cycleId: parsed.data.cycleId,
      userId: userId,
      action: parsed.data.action,
    });
    return NextResponse.json({ ok: true, outcome });
  } catch (e) {
    console.error("School attendance reminder respond error:", e);
    return NextResponse.json({ error: "Failed to save response" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const authResult = await requireParticipantApiSession();
  if (!authResult.ok) return authResult.response;
  const { userId } = authResult.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = DismissSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dismissSchoolAttendanceReminder(parsed.data.cycleId, userId);
  return NextResponse.json({ ok: true });
}
