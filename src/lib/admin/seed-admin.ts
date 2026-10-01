import { randomBytes } from "crypto";

export type SeedAdminPlan =
  | { action: "skip" }
  | { action: "keep" }
  | { action: "create"; password: string; generated: boolean };

export function generateSeedAdminPassword(): string {
  return randomBytes(15).toString("base64url");
}

/**
 * Decide what prisma/seed.ts does with the local dev admin account.
 * - Without SEED_DEV_ADMIN=1 the seed never touches it (staging, production).
 * - An existing account is never modified, so the seed cannot reset its password.
 * - A new account gets SEED_DEV_ADMIN_PASSWORD, or a random one printed once.
 */
export function planSeedAdmin(
  env: Readonly<Record<string, string | undefined>>,
  accountExists: boolean,
  generatePassword: () => string = generateSeedAdminPassword,
): SeedAdminPlan {
  if (env.SEED_DEV_ADMIN !== "1") return { action: "skip" };
  if (accountExists) return { action: "keep" };
  const provided = env.SEED_DEV_ADMIN_PASSWORD;
  if (provided) return { action: "create", password: provided, generated: false };
  return { action: "create", password: generatePassword(), generated: true };
}
