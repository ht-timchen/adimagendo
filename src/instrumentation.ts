/**
 * Runs once when the Next.js server starts.
 * Ensures AUTH_URL has a scheme so NextAuth doesn't throw Invalid URL
 * (e.g. Railway may set AUTH_URL to just the hostname).
 */
function appBaseUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
  if (!/^https?:\/\//i.test(raw)) {
    const trimmed = raw.replace(/^\/+/, "");
    const isLocalhost =
      /^localhost(?::\d+)?$/i.test(trimmed) || /^127\.0\.0\.1(?::\d+)?$/.test(trimmed);
    return `${isLocalhost ? "http" : "https"}://${trimmed}`;
  }
  return raw.replace(/\/$/, "");
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const url = process.env.AUTH_URL;
  if (url && !/^https?:\/\//i.test(url)) {
    const trimmed = url.replace(/^\/+/, "");
    const isLocalhost =
      /^localhost(?::\d+)?$/i.test(trimmed) || /^127\.0\.0\.1(?::\d+)?$/.test(trimmed);
    process.env.AUTH_URL = `${isLocalhost ? "http" : "https"}://${trimmed}`;
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

  // TEST ONLY — every 30s so short REMINDER_TEST_INTERVALS (1m/2m/1m) are picked up.
  // Replace with a production cadence (e.g. hourly) when switching to Fri/Sat/Sun schedule.
  cron.schedule("0 * * * *", async () => {
    try {
      const res = await fetch(
        `${appBaseUrl()}/api/cron/school-attendance-reminders`,
        { headers: { "x-cron-secret": process.env.CRON_SECRET! } }
      );
      if (!res.ok) {
        const body = await res.text();
        console.error(
          "[CRON] School attendance reminders HTTP",
          res.status,
          body
        );
        return;
      }
      const data = (await res.json()) as {
        processed?: number;
        pushesSent?: number;
        completedFromDiary?: number;
      };
      if (
        (data.pushesSent ?? 0) > 0 ||
        (data.completedFromDiary ?? 0) > 0
      ) {
        console.log(
          "[CRON] School attendance reminders:",
          new Date().toISOString(),
          data
        );
      }
    } catch (err) {
      console.error("[CRON] School attendance reminders failed:", err);
    }
  });

  console.log(
    "[CRON] School attendance reminders scheduled (TEST ONLY: every 30s)"
  );

  const { logMailConfigOnce } = await import("@/lib/mail");
  logMailConfigOnce();
}
