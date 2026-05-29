import { NextResponse } from "next/server";
import { auth } from "@/auth";

function canTriggerRedcapSync(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "COORDINATOR";
}

function appBaseUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
  if (!/^https?:\/\//i.test(raw)) {
    return `https://${raw.replace(/^\/+/, "")}`;
  }
  return raw.replace(/\/$/, "");
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !canTriggerRedcapSync(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const result = await fetch(`${appBaseUrl()}/api/cron/redcap-sync`, {
    headers: { "x-cron-secret": process.env.CRON_SECRET! },
  });

  const data = await result.json().catch(() => ({}));
  return NextResponse.json(data, { status: result.ok ? 200 : result.status });
}
