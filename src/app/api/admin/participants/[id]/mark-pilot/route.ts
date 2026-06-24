import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin-api-auth";
import {
  markParticipantAsPilot,
  markPilotParticipantErrorMessage,
} from "@/lib/participant/mark-pilot-participant";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission("participant:mark_pilot");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const result = await markParticipantAsPilot({
      userId: id,
      actorUserId: session.user.id,
    });

    if (!result.ok) {
      const status =
        result.error === "not_found" || result.error === "not_participant"
          ? 404
          : 400;
      return NextResponse.json(
        { error: markPilotParticipantErrorMessage(result.error) },
        { status }
      );
    }

    revalidatePath("/dashboard/admin/participants");

    return NextResponse.json({ ok: true, userId: result.userId });
  } catch (e) {
    console.error("POST /api/admin/participants/[id]/mark-pilot:", e);
    return NextResponse.json(
      { error: "Failed to mark participant as pilot" },
      { status: 500 }
    );
  }
}
