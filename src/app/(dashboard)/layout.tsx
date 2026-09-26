import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdminDashboardRole } from "@/lib/admin-rbac";
import { DashboardLayoutChrome } from "@/components/dashboard-layout-chrome";
import { getParticipantNewNewsCount } from "@/lib/news/news-badge";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const isParticipantOnly =
    session.user.role === "PARTICIPANT" && !isAdminDashboardRole(session);

  if (isParticipantOnly) {
    const profile = await prisma.participantProfile.findUnique({
      where: { userId: session.user.id },
      select: { studyRecordId: true },
    });
    if (!profile?.studyRecordId?.trim()) {
      redirect("/login?error=account_not_enrolled");
    }
  }

  const newNewsCount = isParticipantOnly
    ? await getParticipantNewNewsCount(session.user.id)
    : 0;

  return (
    <DashboardLayoutChrome
      user={session.user}
      newNewsCount={newNewsCount}
      showNewsBell={isParticipantOnly}
      showProfileLink={isParticipantOnly}
    >
      {children}
    </DashboardLayoutChrome>
  );
}
