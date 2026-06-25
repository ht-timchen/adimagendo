#!/usr/bin/env tsx
/**
 * Manual integration check for participant document storage.
 * Run: npx tsx scripts/test-document-upload.ts
 */
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "../src/lib/db";
import { getUploadDir } from "../src/lib/uploads";
import { validateParticipantDocumentFile } from "../src/lib/documents/participant-upload";

async function main() {
  const participant = await prisma.user.findFirst({
    where: {
      role: "PARTICIPANT",
      profile: { is: { studyRecordId: { not: null } } },
    },
    select: { id: true, email: true },
  });

  if (!participant) {
    throw new Error("No enrolled participant found in database");
  }

  const uploadDir = getUploadDir();
  const sampleName = "integration-test.pdf";
  const samplePath = path.join(uploadDir, participant.id, sampleName);
  const sampleBuffer = Buffer.from("%PDF-1.4 integration test");

  const validationError = validateParticipantDocumentFile({
    name: sampleName,
    type: "application/pdf",
    size: sampleBuffer.length,
  });
  if (validationError) {
    throw new Error(`Validation failed: ${validationError}`);
  }

  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(samplePath, sampleBuffer);

  const storageKey = `${participant.id}/${sampleName}`;
  const created = await prisma.document.create({
    data: {
      userId: participant.id,
      type: "REPORT_CARD",
      title: "Integration test upload",
      storageKey,
      mimeType: "application/pdf",
      sizeBytes: sampleBuffer.length,
      isReferral: false,
    },
  });

  const roundTrip = await readFile(path.join(uploadDir, created.storageKey));
  if (!roundTrip.equals(sampleBuffer)) {
    throw new Error("Stored file does not match uploaded bytes");
  }

  const listed = await prisma.document.findMany({
    where: { userId: participant.id, id: created.id },
  });
  if (listed.length !== 1) {
    throw new Error("Uploaded document not found for participant");
  }

  await prisma.document.delete({ where: { id: created.id } });
  await rm(samplePath, { force: true });

  console.log(
    JSON.stringify(
      {
        ok: true,
        participant: participant.email,
        documentId: created.id,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
