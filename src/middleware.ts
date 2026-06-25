import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminDashboardRole } from "@/lib/admin-rbac";

const PARTICIPANT_API_PREFIXES = [
  "/api/checklist/",
  "/api/symptoms",
  "/api/absences",
  "/api/documents",
  "/api/contact",
  "/api/surveys/",
  "/api/appointments/confirm",
  "/api/participant/",
  "/api/school-attendance-reminder",
  "/api/notifications/",
  "/api/push/subscribe",
] as const;

const ADMIN_API_PREFIX = "/api/admin/";

function isParticipantApiPath(pathname: string): boolean {
  return PARTICIPANT_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname === "/register" || pathname === "/signup") {
    return new NextResponse(null, { status: 404 });
  }

  if (pathname === "/api/auth/register") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isLoggedIn = !!req.auth?.user;
  const role = req.auth?.user?.role;

  if (pathname.startsWith("/dashboard")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (pathname.startsWith("/dashboard/admin") && !isAdminDashboardRole(req.auth)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  if (isParticipantApiPath(pathname) && !isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (pathname.startsWith(ADMIN_API_PREFIX) && !isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    pathname.startsWith(ADMIN_API_PREFIX) &&
    isLoggedIn &&
    !isAdminDashboardRole(req.auth)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    isParticipantApiPath(pathname) &&
    isLoggedIn &&
    isAdminDashboardRole(req.auth)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    isParticipantApiPath(pathname) &&
    isLoggedIn &&
    role === "PARTICIPANT"
  ) {
    // studyRecordId is enforced in each API via requireParticipantApiSession().
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/register",
    "/signup",
    "/api/auth/register",
    "/dashboard/:path*",
    "/api/checklist/:path*",
    "/api/symptoms",
    "/api/absences",
    "/api/documents",
    "/api/documents/:path*",
    "/api/contact",
    "/api/surveys/:path*",
    "/api/appointments/confirm",
    "/api/participant/:path*",
    "/api/school-attendance-reminder",
    "/api/notifications/:path*",
    "/api/push/subscribe",
    "/api/admin/:path*",
  ],
};
