/**
 * Set a new password for the bootstrap super admin (admin@adimagendo.local).
 * Safe to re-run, e.g. when the password is forgotten. Only passwordHash is changed, and every
 * session signed in before now is ended (sessionsRevokedAt).
 *
 * The password is read from NEW_ADMIN_PASSWORD (never from argv, so it stays out of
 * shell history). Remove that variable again once the script has run.
 * Usage: NEW_ADMIN_PASSWORD='...' npm run admin:set-password
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { sessionRevocationData } from "../src/lib/auth/session-revocation";
import {
  BOOTSTRAP_ADMIN_EMAIL,
  validateNewAdminPassword,
} from "../src/lib/admin/admin-password";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.NEW_ADMIN_PASSWORD;
  const passwordError = validateNewAdminPassword(password);
  if (passwordError || !password) {
    console.error(passwordError);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email: BOOTSTRAP_ADMIN_EMAIL },
    select: { id: true, email: true, role: true, superAdmin: true },
  });

  if (!user) {
    console.error(`User not found: ${BOOTSTRAP_ADMIN_EMAIL} (nothing was changed).`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, ...sessionRevocationData() },
  });

  console.log(`Password updated for ${user.email}. Now remove NEW_ADMIN_PASSWORD.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
