import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ClinicalAdminShell } from "@/components/admin/clinical-admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const r = session.user.role;
  if (r !== "ADMIN" && r !== "SUPER_ADMIN") {
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
        role: r,
        superAdmin: me?.superAdmin ?? session.user.superAdmin ?? false,
      }}
    >
      {children}
    </ClinicalAdminShell>
  );
}
