/**
 * Runs once when the Next.js server starts.
 * Ensures AUTH_URL has a scheme so NextAuth doesn't throw Invalid URL
 * (e.g. Railway may set AUTH_URL to just the hostname).
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const url = process.env.AUTH_URL;
  if (url && !/^https?:\/\//i.test(url)) {
    process.env.AUTH_URL = `https://${url.replace(/^\/+/, "")}`;
  }
}
