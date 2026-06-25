import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { getUploadDir } from "@/lib/uploads";
import { validateParticipantDocumentFile } from "@/lib/documents/participant-upload";

function fileExtension(name: string): string {
  const ext = path.extname(name);
  return ext || ".pdf";
}

export type UploadParticipantDocumentInput = {
  userId: string;
  file: File;
  title?: string | null;
  type?: string | null;
};

export type UploadParticipantDocumentResult =
  | { ok: true; document: Awaited<ReturnType<typeof prisma.document.create>> }
  | { ok: false; status: number; error: string };

export async function uploadParticipantDocument(
  input: UploadParticipantDocumentInput
): Promise<UploadParticipantDocumentResult> {
  const validationError = validateParticipantDocumentFile({
    name: input.file.name,
    type: input.file.type,
    size: input.file.size,
  });
  if (validationError) {
    return { ok: false, status: 400, error: validationError };
  }

  const bytes = await input.file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = fileExtension(input.file.name);
  const safeTitle =
    (typeof input.title === "string" && input.title.trim()) || input.file.name;
  const uploadDir = getUploadDir();
  const userDir = path.join(uploadDir, input.userId);
  await mkdir(userDir, { recursive: true });
  const filename = `${Date.now()}${ext}`;
  const storageKey = `${input.userId}/${filename}`;
  await writeFile(path.join(uploadDir, storageKey), buffer);

  const document = await prisma.document.create({
    data: {
      userId: input.userId,
      type: input.type === "REFERRAL" ? "REFERRAL" : "REPORT_CARD",
      title: safeTitle.slice(0, 200),
      storageKey,
      mimeType: input.file.type || null,
      sizeBytes: buffer.length,
      isReferral: false,
    },
  });

  return { ok: true, document };
}
