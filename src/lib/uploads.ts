import path from "path";

/**
 * Upload directory for document files.
 * - Local: defaults to ./uploads (relative to cwd)
 * - Railway: set UPLOAD_DIR=/data/uploads so uploads persist on the volume
 */
export function getUploadDir(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
}
