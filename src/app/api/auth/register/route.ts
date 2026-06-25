import { NextResponse } from "next/server";

/** Public self-registration is disabled; participants enrol via magic link only. */
export async function POST() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
