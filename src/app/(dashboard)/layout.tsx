import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdminDashboardRole } from "@/lib/admin-rbac";
import { DashboardLayoutChrome } from "@/components/dashboard-layout-chrome";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role === "PARTICIPANT" &&
    !isAdminDashboardRole(session)
  ) {
    const profile = await prisma.participantProfile.findUnique({
      where: { userId: session.user.id },
      select: { studyRecordId: true },
    });
    if (!profile?.studyRecordId?.trim()) {
      redirect("/login?error=account_not_enrolled");
    }
  }

  return <DashboardLayoutChrome user={session.user}>{children}</DashboardLayoutChrome>;
}
