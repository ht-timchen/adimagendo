import { NextResponse } from "next/server";

/** Participant accounts and studyRecordId binding are only created via enrolment links. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "CSV participant linking is disabled. Participant accounts must be created through enrolment links.",
    },
    { status: 403 }
  );
}
