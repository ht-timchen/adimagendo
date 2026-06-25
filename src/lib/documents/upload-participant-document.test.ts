import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdir, readFile, rm } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { getUploadDir } from "@/lib/uploads";
import { uploadParticipantDocument } from "@/lib/documents/upload-participant-document";

const TEST_USER_ID = "doc-upload-lib-test-user";

describe("uploadParticipantDocument", () => {
  const createdIds: string[] = [];

  before(async () => {
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      create: {
        id: TEST_USER_ID,
        email: "doc-upload-lib-test@example.com",
        role: "PARTICIPANT",
      },
      update: {},
    });
    await mkdir(path.join(getUploadDir(), TEST_USER_ID), { recursive: true });
  });

  after(async () => {
    for (const id of createdIds) {
      const doc = await prisma.document.findUnique({ where: { id } });
      if (doc?.storageKey) {
        await rm(path.join(getUploadDir(), doc.storageKey), { force: true });
      }
      await prisma.document.delete({ where: { id } }).catch(() => undefined);
    }
    await rm(path.join(getUploadDir(), TEST_USER_ID), {
      recursive: true,
      force: true,
    });
    await prisma.user.delete({ where: { id: TEST_USER_ID } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("rejects unsupported file types", async () => {
    const result = await uploadParticipantDocument({
      userId: TEST_USER_ID,
      file: new File(["hello"], "notes.txt", { type: "text/plain" }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
      assert.match(result.error, /Unsupported file type/i);
    }
  });

  it("stores a PDF for the participant", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4 lib test");
    const result = await uploadParticipantDocument({
      userId: TEST_USER_ID,
      file: new File([pdfBytes], "report-card.pdf", {
        type: "application/pdf",
      }),
      title: "Lib test card",
      type: "REPORT_CARD",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    createdIds.push(result.document.id);
    assert.equal(result.document.title, "Lib test card");
    assert.match(result.document.storageKey, new RegExp(`^${TEST_USER_ID}/`));

    const stored = await readFile(
      path.join(getUploadDir(), result.document.storageKey)
    );
    assert.ok(stored.equals(pdfBytes));
  });

  it("stores an image for the participant", async () => {
    const result = await uploadParticipantDocument({
      userId: TEST_USER_ID,
      file: new File([Buffer.from("fakepng")], "scan.png", {
        type: "image/png",
      }),
      type: "REPORT_CARD",
    });
    assert.equal(result.ok, true);
    if (result.ok) createdIds.push(result.document.id);
  });
});
