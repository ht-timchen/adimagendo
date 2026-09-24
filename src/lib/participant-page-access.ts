import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { prisma } from "@/lib/db";
import { isAdminDashboardRole } from "@/lib/admin-rbac";

/**
 * For PARTICIPANT sessions, re-read User.isActive from the database.
 * Session.user.active is not authoritative after an admin deactivation.
 * Call after auth() on participant pages so a fresh server request can redirect
 * to /account-deactivated. Does not guarantee every client navigation re-queries.
 */
export async function requireActiveParticipantPage(
  session: Session | null | undefined
): Promise<void> {
  if (!session?.user?.id) return;
  if (session.user.role !== "PARTICIPANT" || isAdminDashboardRole(session)) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });

  if (!user || user.isActive !== true) {
    redirect("/account-deactivated");
  }
}
