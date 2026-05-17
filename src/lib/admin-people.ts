import { randomBytes } from "crypto";
import { Role } from "@prisma/client";

export const PROTECTED_ADMIN_EMAIL = "admin@adimagendo.local";

export type PeopleRole = "USER" | "ADMIN" | "SUPER_ADMIN";

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

/** Readable temporary password for admin handoff (no email required). */
export function generateTemporaryPassword(length = 12): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function appBaseUrl(): string {
  const raw = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export function acceptInviteUrl(token: string): string {
  return `${appBaseUrl()}/auth/accept-invite?token=${encodeURIComponent(token)}`;
}

export function isSuperAdminSession(user: {
  role?: string;
  superAdmin?: boolean;
}): boolean {
  return user.role === "SUPER_ADMIN" || user.superAdmin === true;
}

export function displayPeopleRole(user: {
  role: Role;
  superAdmin: boolean;
}): PeopleRole {
  if (user.superAdmin) return "SUPER_ADMIN";
  if (user.role === Role.ADMIN) return "ADMIN";
  return "USER";
}

export function parsePeopleRoleInput(role: string): {
  prismaRole: typeof Role.USER | typeof Role.ADMIN;
  superAdmin: boolean;
} {
  if (role === "SUPER_ADMIN") return { prismaRole: Role.ADMIN, superAdmin: true };
  if (role === "ADMIN") return { prismaRole: Role.ADMIN, superAdmin: false };
  return { prismaRole: Role.USER, superAdmin: false };
}

export function isStaffUser(role: Role): boolean {
  return role === Role.USER || role === Role.ADMIN;
}
