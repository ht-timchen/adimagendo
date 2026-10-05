import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ClinicalAdminOverviewDashboard } from "@/components/admin/clinical-admin-overview-dashboard";
import { RANGE_OPTIONS, loadDashboardData } from "@/lib/admin/admin-overview-data";
import { countUnreadContactMessages } from "@/lib/admin/contact-message-inbox";
import { hasPermission, isAdminDashboardRole } from "@/lib/admin-rbac";

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; page?: string; filter?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isAdminDashboardRole(session)) redirect("/dashboard");

  const sp = await searchParams;
  const data = await loadDashboardData(sp, new Date());
  const adminName =
    session.user.name?.trim() || session.user.email.split("@")[0] || "there";
  const adminInitial = adminName.slice(0, 1).toUpperCase();
  const unreadContactMessageCount = await countUnreadContactMessages();

  return (
    <ClinicalAdminOverviewDashboard
      data={data}
      adminName={adminName}
      adminInitial={adminInitial}
      rangeOptions={RANGE_OPTIONS}
      canSendNotification={hasPermission(session, "notification:send")}
      unreadContactMessageCount={unreadContactMessageCount}
      canViewImportAction={hasPermission(session, "import:manage")}
      canViewExportAction={hasPermission(session, "symptom_diary:export")}
      canViewBroadcastAction={hasPermission(session, "notification:broadcast")}
    />
  );
}
