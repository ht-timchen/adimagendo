import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/db";
import { validateBroadcastInput } from "@/lib/notifications/broadcast-notifications";
import { BroadcastInProgressError, broadcastToActiveParticipants } from "@/lib/notifications/broadcast-service";

export async function POST(req: Request) {
  const session = await requirePermission("notification:broadcast");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = validateBroadcastInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const outcome = await broadcastToActiveParticipants(prisma, { ...parsed.input, session });
    return NextResponse.json({
      ok: true,
      status: outcome.status,
      count: outcome.status === "no-recipients" ? 0 : outcome.count,
      ...(outcome.status === "created" && outcome.push ? { push: outcome.push } : {}),
    });
  } catch (e) {
    if (e instanceof BroadcastInProgressError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error("POST /api/admin/notifications/broadcast:", e);
    return NextResponse.json(
      { error: "The notifications could not be created and nothing was sent. Your message is still here, so you can try again." },
      { status: 500 }
    );
  }
}
