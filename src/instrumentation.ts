/**
 * Runs once when the Next.js server starts.
 * Ensures AUTH_URL has a scheme so NextAuth doesn't throw Invalid URL
 * (e.g. Railway may set AUTH_URL to just the hostname).
 */
function appBaseUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
  if (!/^https?:\/\//i.test(raw)) {
    return `https://${raw.replace(/^\/+/, "")}`;
  }
  return raw.replace(/\/$/, "");
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const url = process.env.AUTH_URL;
  if (url && !/^https?:\/\//i.test(url)) {
    process.env.AUTH_URL = `https://${url.replace(/^\/+/, "")}`;
  }

  const { default: cron } = await import("node-cron");

  // Run at 2:00 AM Adelaide time (UTC+9:30 → 16:30 UTC)
  cron.schedule("30 16 * * *", async () => {
    try {
      await fetch(`${appBaseUrl()}/api/cron/redcap-sync`, {
        headers: { "x-cron-secret": process.env.CRON_SECRET! },
      });
      console.log("[CRON] REDCap sync completed:", new Date().toISOString());
    } catch (err) {
      console.error("[CRON] REDCap sync failed:", err);
    }
  });

  console.log("[CRON] REDCap nightly sync scheduled (2:00 AM Adelaide)");
}
