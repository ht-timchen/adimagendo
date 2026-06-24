import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const authUrl = process.env.AUTH_URL;
if (authUrl && !/^https?:\/\//i.test(authUrl)) {
  const trimmed = authUrl.replace(/^\/+/, "");
  const isLocalhost =
    /^localhost(?::\d+)?$/i.test(trimmed) || /^127\.0\.0\.1(?::\d+)?$/.test(trimmed);
  process.env.AUTH_URL = `${isLocalhost ? "http" : "https"}://${trimmed}`;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).toLowerCase();
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            passwordHash: true,
            isActive: true,
            superAdmin: true,
          },
        });
        if (!user?.passwordHash) return null;
        if (!user.isActive) return null;
        const ok = await bcrypt.compare(String(credentials.password), user.passwordHash);
        if (!ok) return null;
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        const sessionRole = user.superAdmin ? "SUPER_ADMIN" : user.role;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
          role: sessionRole,
          active: user.isActive,
          superAdmin: user.superAdmin,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        const u = user as {
          id: string;
          email: string;
          role: string;
          active?: boolean;
          superAdmin?: boolean;
        };
        token.id = u.id;
        token.email = u.email;
        token.role = u.role;
        token.active = u.active ?? true;
        token.superAdmin = u.superAdmin ?? false;
      } else if (trigger === "update" && token.id) {
        const db = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { email: true, role: true, isActive: true, superAdmin: true },
        });
        if (db) {
          token.email = db.email;
          token.active = db.isActive;
          token.superAdmin = db.superAdmin;
          token.role = db.superAdmin ? "SUPER_ADMIN" : db.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.role = (token.role as string) ?? "PARTICIPANT";
        session.user.active = token.active !== false;
        session.user.superAdmin = token.superAdmin === true;
      }
      return session;
    },
  },
});
