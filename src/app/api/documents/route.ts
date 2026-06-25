import { NextResponse } from "next/server";
import { requireParticipantApiSession } from "@/lib/participant-api-auth";
import { PARTICIPANT_DOCUMENT_MAX_BYTES } from "@/lib/documents/participant-upload";
import { uploadParticipantDocument } from "@/lib/documents/upload-participant-document";
import { prisma } from "@/lib/db";

export async function GET() {
  const authResult = await requireParticipantApiSession();
  if (!authResult.ok) return authResult.response;
  const { userId } = authResult.ctx;
  const docs = await prisma.document.findMany({
    where: { userId: userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(docs);
}

export async function POST(req: Request) {
  const authResult = await requireParticipantApiSession();
  if (!authResult.ok) return authResult.response;
  const { userId } = authResult.ctx;

  try {
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > PARTICIPANT_DOCUMENT_MAX_BYTES) {
      return NextResponse.json(
        { error: "File is too large. Maximum size is 10 MB." },
        { status: 413 }
      );
    }

    const formData = await req.formData();
    const fileValue = formData.get("file");
    const title = formData.get("title");
    const type = formData.get("type");

    if (!(fileValue instanceof File)) {
      return NextResponse.json(
        { error: "Please select a file" },
        { status: 400 }
      );
    }

    const result = await uploadParticipantDocument({
      userId,
      file: fileValue,
      title: typeof title === "string" ? title : null,
      type: typeof type === "string" ? type : null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.document);
  } catch (e) {
    console.error("Document upload error:", e);
    return NextResponse.json(
      { error: "Failed to upload" },
      { status: 500 }
    );
  }
}
