import { redirect } from "next/navigation";
import { auth } from "@/auth";
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

  return <DashboardLayoutChrome user={session.user}>{children}</DashboardLayoutChrome>;
}
