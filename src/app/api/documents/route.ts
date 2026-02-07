import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getUploadDir } from "@/lib/uploads";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const docs = await prisma.document.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(docs);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const type = (formData.get("type") as string) || "REPORT_CARD";
    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = path.extname(file.name) || ".pdf";
    const safeTitle = (title || file.name).slice(0, 200);
    const uploadDir = getUploadDir();
    const dir = path.join(uploadDir, session.user.id);
    await mkdir(dir, { recursive: true });
    const filename = `${Date.now()}${ext}`;
    const storageKey = path.join(session.user.id, filename);
    await writeFile(path.join(uploadDir, storageKey), buffer);
    const doc = await prisma.document.create({
      data: {
        userId: session.user.id,
        type: type === "REFERRAL" ? "REFERRAL" : "REPORT_CARD",
        title: safeTitle,
        storageKey,
        mimeType: file.type || null,
        sizeBytes: buffer.length,
        isReferral: false,
      },
    });
    return NextResponse.json(doc);
  } catch (e) {
    console.error("Document upload error:", e);
    return NextResponse.json(
      { error: "Failed to upload" },
      { status: 500 }
    );
  }
}
