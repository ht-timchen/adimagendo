import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-api-auth";
import { ADMIN_AUDIT_ACTIONS, recordAdminAuditEvent } from "@/lib/admin-audit";

function appBaseUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
  if (!/^https?:\/\//i.test(raw)) {
    return `https://${raw.replace(/^\/+/, "")}`;
  }
  return raw.replace(/\/$/, "");
}

export async function POST() {
  const session = await requirePermission("redcap:sync");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const result = await fetch(`${appBaseUrl()}/api/cron/redcap-sync`, {
    headers: { "x-cron-secret": process.env.CRON_SECRET! },
  });

  const data = await result.json().catch(() => ({}));

  if (result.ok) {
    await recordAdminAuditEvent({
      session,
      action: ADMIN_AUDIT_ACTIONS.REDCAP_SYNC_TRIGGERED,
      targetType: "redcap",
      targetName: "REDCap sync",
      metadata:
        typeof data === "object" && data !== null
          ? (data as Record<string, unknown>)
          : undefined,
    });
  }

  return NextResponse.json(data, { status: result.ok ? 200 : result.status });
}
