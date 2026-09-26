import { NextResponse } from "next/server";
import { requireParticipantApiSession } from "@/lib/participant-api-auth";
import { markParticipantNewsViewed } from "@/lib/news/news-badge";

/**
 * Records that the participant opened the News list.
 * Must be called from the client after a real visit — not from RSC/prefetch render.
 */
export async function POST() {
  const authResult = await requireParticipantApiSession();
  if (!authResult.ok) return authResult.response;

  try {
    await markParticipantNewsViewed(authResult.ctx.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/participant/news-viewed:", e);
    return NextResponse.json(
      { error: "Failed to update news visit" },
      { status: 500 }
    );
  }
}
