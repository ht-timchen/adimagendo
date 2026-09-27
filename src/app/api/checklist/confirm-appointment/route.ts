import { NextResponse } from "next/server";
import { requireParticipantApiSession } from "@/lib/participant-api-auth";
import { confirmChecklistAppointment } from "@/lib/checklist/checklist-booking-requests";
import { z } from "zod";

const BodySchema = z.object({
  templateId: z.string().min(1),
  scheduledStartAt: z.string().min(1),
  scheduledLocation: z.string().optional().nullable(),
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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await confirmChecklistAppointment({
    userId,
    templateId: parsed.data.templateId,
    scheduledStartAt: parsed.data.scheduledStartAt,
    scheduledLocation: parsed.data.scheduledLocation,
  });
  return NextResponse.json(result.body, { status: result.status });
}
