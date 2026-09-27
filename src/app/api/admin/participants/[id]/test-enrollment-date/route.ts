import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin-api-auth";
import {
  isTestEnrollmentDateToolsEnabled,
  setTestEnrollmentDate,
  TEST_ENROLMENT_DATE_TOOLS_DISABLED_MESSAGE,
} from "@/lib/participant/test-enrollment-date";
import { classificationChangeErrorStatus } from "@/lib/participant/classification-change-common";
import type { ClassificationChangeReasonInput } from "@/lib/participant/classification-change-reason";

type Body = ClassificationChangeReasonInput & { date?: unknown };

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTestEnrollmentDateToolsEnabled()) {
    return NextResponse.json(
      { error: TEST_ENROLMENT_DATE_TOOLS_DISABLED_MESSAGE },
      { status: 403 }
    );
  }

  const session = await requirePermission("participant:classify");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: Body | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await setTestEnrollmentDate({
      userId: id,
      session,
      date: body?.date,
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
    console.error("PATCH /api/admin/participants/[id]/test-enrollment-date:", e);
    return NextResponse.json(
      { error: "Failed to change test enrolment date" },
      { status: 500 }
    );
  }
}
