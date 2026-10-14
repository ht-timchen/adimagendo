import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/db";
import {
  ContactReplyError,
  contactReplyErrorStatus,
  contactReplyResultMessage,
  replyToContactMessage,
  validateContactReplyInput,
} from "@/lib/admin/contact-message-reply";

/**
 * Reply to one participant's contact message. The body carries only the title, the text and
 * a submission id; the recipient is always the message's author.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission("contact_message:reply");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = validateContactReplyInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const outcome = await replyToContactMessage(prisma, {
      ...parsed.input,
      session,
      contactMessageId: id,
    });
    const message = contactReplyResultMessage(outcome);
    return NextResponse.json({
      ok: true,
      status: outcome.status,
      ...(outcome.status === "created" ? { push: outcome.push } : {}),
      tone: message.tone,
      message: message.text,
    });
  } catch (e) {
    if (e instanceof ContactReplyError) {
      return NextResponse.json({ error: e.message }, { status: contactReplyErrorStatus(e.code) });
    }
    console.error("POST /api/admin/messages/[id]/reply:", e instanceof Error ? e.name : "unknown error");
    return NextResponse.json(
      { error: "The reply could not be saved and nothing was sent. Your text is still here, so you can try again." },
      { status: 500 }
    );
  }
}
