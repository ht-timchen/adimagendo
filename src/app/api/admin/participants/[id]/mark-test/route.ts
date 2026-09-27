import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin-api-auth";
import { markParticipantAsTest } from "@/lib/participant/mark-test-participant";
import { classificationChangeErrorStatus } from "@/lib/participant/classification-change-common";
import type { ClassificationChangeReasonInput } from "@/lib/participant/classification-change-reason";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission("participant:classify");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: ClassificationChangeReasonInput | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await markParticipantAsTest({
      userId: id,
      session,
      reason: body ?? {},
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message },
        { status: classificationChangeErrorStatus(result.error) }
      );
    }

    revalidatePath("/dashboard/admin/participants");
    revalidatePath("/dashboard/admin/participants/[recordId]", "page");

    return NextResponse.json({ ok: true, userId: result.userId });
  } catch (e) {
    console.error("POST /api/admin/participants/[id]/mark-test:", e);
    return NextResponse.json(
      { error: "Failed to mark participant as test" },
      { status: 500 }
    );
  }
}
