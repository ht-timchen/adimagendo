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

export async function ensurePeopleAdmin() {
  const session = await ensureAdmin();
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { superAdmin: true, email: true },
  });
  const envList = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const superCount = await prisma.user.count({ where: { superAdmin: true } });
  const isSuper =
    me?.superAdmin === true || envList.includes(session.user.email.toLowerCase());
  const bootstrap = superCount === 0 && envList.length === 0;
  if (!isSuper && !bootstrap) redirect("/dashboard/admin");
  return session;
}
