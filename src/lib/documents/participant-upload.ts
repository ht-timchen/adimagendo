export const PARTICIPANT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

export function validateParticipantDocumentFile(input: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!input.size || input.size <= 0) {
    return "Please select a file";
  }
  if (input.size > PARTICIPANT_DOCUMENT_MAX_BYTES) {
    return "File is too large. Maximum size is 10 MB.";
  }

  const ext = fileExtension(input.name);
  const mime = input.type.trim().toLowerCase();
  const mimeOk = mime.length > 0 && ALLOWED_MIME_TYPES.has(mime);
  const extOk = ext.length > 0 && ALLOWED_EXTENSIONS.has(ext);

  if (!mimeOk && !extOk) {
    return "Unsupported file type. Please upload a PDF or image (PNG, JPG, JPEG, WEBP).";
  }

  return null;
}

export function participantDocumentUploadErrorMessage(
  status: number,
  error: unknown
): string {
  if (typeof error === "string" && error.trim()) return error;
  if (status === 401) return "Please sign in again to upload your report card.";
  if (status === 403) return "You do not have permission to upload documents.";
  if (status === 400) {
    return "Could not upload this file. Please check the file and try again.";
  }
  if (status === 413) return "File is too large. Maximum size is 10 MB.";
  return "Upload failed. Please try again.";
}
