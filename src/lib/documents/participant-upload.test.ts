import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PARTICIPANT_DOCUMENT_MAX_BYTES,
  participantDocumentUploadErrorMessage,
  validateParticipantDocumentFile,
} from "@/lib/documents/participant-upload";

describe("validateParticipantDocumentFile", () => {
  it("rejects empty files", () => {
    assert.equal(
      validateParticipantDocumentFile({ name: "card.pdf", type: "application/pdf", size: 0 }),
      "Please select a file"
    );
  });

  it("allows PDF files", () => {
    assert.equal(
      validateParticipantDocumentFile({
        name: "report.pdf",
        type: "application/pdf",
        size: 1024,
      }),
      null
    );
  });

  it("allows common image files", () => {
    for (const sample of [
      { name: "scan.png", type: "image/png" },
      { name: "photo.jpg", type: "image/jpeg" },
      { name: "photo.jpeg", type: "image/jpeg" },
      { name: "photo.webp", type: "image/webp" },
    ]) {
      assert.equal(
        validateParticipantDocumentFile({ ...sample, size: 2048 }),
        null,
        sample.name
      );
    }
  });

  it("rejects unsupported file types", () => {
    assert.match(
      validateParticipantDocumentFile({
        name: "notes.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 1024,
      }) ?? "",
      /Unsupported file type/
    );
  });

  it("rejects files over the size limit", () => {
    assert.match(
      validateParticipantDocumentFile({
        name: "big.pdf",
        type: "application/pdf",
        size: PARTICIPANT_DOCUMENT_MAX_BYTES + 1,
      }) ?? "",
      /too large/i
    );
  });
});

describe("participantDocumentUploadErrorMessage", () => {
  it("maps auth and permission failures", () => {
    assert.match(participantDocumentUploadErrorMessage(401, null), /sign in/i);
    assert.match(participantDocumentUploadErrorMessage(403, null), /permission/i);
  });
});
