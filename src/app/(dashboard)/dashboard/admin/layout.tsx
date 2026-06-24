import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ClinicalAdminShell } from "@/components/admin/clinical-admin-shell";
import { hasPermission, isAdminDashboardRole } from "@/lib/admin-rbac";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!isAdminDashboardRole(session)) {
    redirect("/dashboard");
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { superAdmin: true },
  });

  return (
    <ClinicalAdminShell
      user={{
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        role: session.user.role,
        superAdmin: me?.superAdmin ?? session.user.superAdmin ?? false,
        canViewStaffList: hasPermission(session, "admin_user:read"),
        canViewSettings: hasPermission(session, "settings:read"),
        canViewImport: hasPermission(session, "import:manage"),
        canViewExport: hasPermission(session, "symptom_diary:export"),
        canViewNotifications: hasPermission(session, "notification:send") || hasPermission(session, "notification:broadcast"),
        canViewEnrolment: hasPermission(session, "enrolment:manage"),
      }}
    >
      {children}
    </ClinicalAdminShell>
  );
}
