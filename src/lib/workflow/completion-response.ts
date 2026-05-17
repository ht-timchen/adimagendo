import { NextResponse } from "next/server";

export type CompletionOkBody = { ok: true } | { ok: true; alreadyCompleted: true };

export function completionOkResponse(
  body: CompletionOkBody = { ok: true }
): NextResponse {
  return NextResponse.json(body);
}

export function alreadyCompletedResponse(): NextResponse {
  return completionOkResponse({ ok: true, alreadyCompleted: true });
}
