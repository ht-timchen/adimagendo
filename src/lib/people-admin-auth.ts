import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function ensureAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const r = session.user.role;
  if (r !== "ADMIN" && r !== "SUPER_ADMIN") redirect("/dashboard");
  return session;
}

/** Can access People page and assign ADMIN / SUPER_ADMIN roles (DB + env, not JWT-only). */
export async function canAssignStaffRoles(
  userId: string,
  email: string,
  sessionRole?: string
): Promise<boolean> {
  if (sessionRole === "SUPER_ADMIN") return true;

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { superAdmin: true },
  });
  const envList = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const superCount = await prisma.user.count({ where: { superAdmin: true } });
  const bootstrap = superCount === 0 && envList.length === 0;
  if (bootstrap) return true;
  if (me?.superAdmin === true) return true;
  if (envList.includes(email.toLowerCase())) return true;
  return false;
}

/** Super-admin-only flows (legacy server actions). People page uses {@link ensureAdmin} instead. */
export async function ensurePeopleAdmin() {
  const session = await ensureAdmin();
  const isSuper = await canAssignStaffRoles(session.user.id, session.user.email);
  if (!isSuper) redirect("/dashboard/admin");
  return session;
}
