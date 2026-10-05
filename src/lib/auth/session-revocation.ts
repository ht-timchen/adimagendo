/**
 * Prisma `data` fragment that ends every session signed in before now.
 * Spread it into the update of any admin-initiated password reset:
 *   data: { <the new password hash>, ...sessionRevocationData(), ... }
 * Date.now() is the single time source, the same one that stamps `authTime` into the
 * session token at sign-in, so the two are always comparable.
 */
export function sessionRevocationData(now: number = Date.now()): { sessionsRevokedAt: Date } {
  return { sessionsRevokedAt: new Date(now) };
}
