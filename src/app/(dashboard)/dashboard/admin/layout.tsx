import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Everything under /dashboard/admin is visible only to users with role ADMIN. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
