/** Email of the bootstrap super admin whose password the reset script manages. */
export const BOOTSTRAP_ADMIN_EMAIL = "admin@adimagendo.local";

export const MIN_ADMIN_PASSWORD_LENGTH = 16;

/** Password that is committed to git history (prisma/seed.ts); must never be reused. */
const KNOWN_SEED_PASSWORD = "imagendoadmin";

/** Returns an error message, or null when the password is acceptable. */
export function validateNewAdminPassword(password: string | undefined): string | null {
  if (!password) return "NEW_ADMIN_PASSWORD is not set.";
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    return `NEW_ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.toLowerCase().includes(KNOWN_SEED_PASSWORD)) {
    return "NEW_ADMIN_PASSWORD must not contain the default seed password.";
  }
  return null;
}
