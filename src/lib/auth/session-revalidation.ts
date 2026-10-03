/** The User columns that decide what a session may do. */
export type SessionUserRow = {
  email: string;
  role: string;
  isActive: boolean;
  superAdmin: boolean;
};

type TokenLike = {
  id?: string;
  email?: string | null;
  role?: string;
  active?: boolean;
  superAdmin?: boolean;
};

/**
 * Bring a session token in line with the current User row.
 *
 * - User deleted, or a staff account deactivated: null, which ends the session.
 * - A deactivated participant keeps the token with active=false, so the existing
 *   participant guards still show /account-deactivated (pages) or 403 (API).
 * - Role, superAdmin and email always come from the database, so a demotion
 *   takes effect immediately instead of when the token expires.
 */
export function revalidateToken<T extends TokenLike>(
  token: T,
  user: SessionUserRow | null
): T | null {
  if (!user) return null;
  const isStaff = user.superAdmin || user.role !== "PARTICIPANT";
  if (!user.isActive && isStaff) return null;
  return {
    ...token,
    email: user.email,
    active: user.isActive,
    superAdmin: user.superAdmin,
    role: user.superAdmin ? "SUPER_ADMIN" : user.role,
  };
}

type RevalidationLogger = (
  message: string,
  details: { errorName: string; code?: string }
) => void;

/**
 * Re-read the user and revalidate the token. If the lookup itself fails, keep
 * the existing token: logging a participant out because of a database hiccup
 * could make them miss a time-limited task, and the app is unusable anyway when
 * the database is down. Only the error name and code are logged (no personal data).
 */
export async function refreshTokenFromDatabase<T extends TokenLike>(
  token: T,
  loadUser: (userId: string) => Promise<SessionUserRow | null>,
  logError: RevalidationLogger = console.error
): Promise<T | null> {
  if (!token.id) return token;
  try {
    return revalidateToken(token, await loadUser(token.id));
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    logError("[auth] session revalidation failed; keeping existing token", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      ...(typeof code === "string" ? { code } : {}),
    });
    return token;
  }
}
