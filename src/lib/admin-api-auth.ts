import { auth } from "@/auth";

export async function requireAdminSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const r = session.user.role;
  if (r !== "ADMIN" && r !== "SUPER_ADMIN") return null;
  return session;
}
