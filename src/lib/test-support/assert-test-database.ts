import path from "node:path";

/**
 * Call at the top of every test file that touches the database. Throws unless
 * DATABASE_URL is a SQLite file named test.db.
 */
export function assertTestDatabase(url: string | undefined = process.env.DATABASE_URL): void {
  const filePath = url?.startsWith("file:") ? url.slice("file:".length).split("?")[0] : null;
  if (!filePath || path.basename(filePath) !== "test.db") {
    throw new Error(
      "Refusing to run database tests: DATABASE_URL must point to test.db. " +
        "Run: DATABASE_URL=file:./test.db UPLOAD_DIR=./.test-uploads npm test"
    );
  }
}
