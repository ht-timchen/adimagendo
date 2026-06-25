import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  EnrolmentRegistrationError,
  parseEnrolmentClientPayload,
  registerParticipantViaToken,
} from "@/lib/enrolment/register-via-token";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const payload = parseEnrolmentClientPayload(body);
    const result = await registerParticipantViaToken(token, payload, { db: prisma });

    return NextResponse.json({ success: true, email: result.email });
  } catch (e) {
    if (e instanceof EnrolmentRegistrationError) {
      return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    }
    console.error("POST /api/enrol/[token]:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
