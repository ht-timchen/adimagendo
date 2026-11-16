"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardNav } from "@/components/dashboard-nav";
import { ParticipantBrandLogo } from "@/components/auth/participant-brand-logo";
import { participantFocusRingClassName } from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";

type ChromeUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  role?: string;
};

export function DashboardLayoutChrome({
  children,
  user,
  newNewsCount = 0,
  showNewsBell = false,
  unreadNotificationCount = 0,
  showNotificationsLink = false,
  showProfileLink = false,
}: {
  children: React.ReactNode;
  user: ChromeUser;
  newNewsCount?: number;
  showNewsBell?: boolean;
  unreadNotificationCount?: number;
  showNotificationsLink?: boolean;
  showProfileLink?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const hideParticipantChrome = pathname.startsWith("/dashboard/admin");

  if (hideParticipantChrome) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">{children}</div>
    );
  }

  return (
    <div className="dashboard-participant-light light [color-scheme:light] relative isolate flex min-h-screen flex-col bg-participant-page">
      <header className="relative sticky top-0 z-20 border-b border-participant-primary/10 bg-participant-page/70 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3 px-2 md:px-3">
          <Link
            href="/dashboard"
            aria-label="Dashboard home"
            className={cn("inline-flex shrink-0 rounded-full", participantFocusRingClassName)}
          >
            <ParticipantBrandLogo
              className="mx-0"
              sizeClassName="h-16 w-16"
              imageSrc="/images/adimagendo-mascot-rose.png"
              priority
            />
          </Link>
          <DashboardNav
            user={user}
            newNewsCount={newNewsCount}
            showNewsBell={showNewsBell}
            unreadNotificationCount={unreadNotificationCount}
            showNotificationsLink={showNotificationsLink}
            showProfileLink={showProfileLink}
          />
        </div>
      </header>
      <main className="relative z-10 dashboard-main-safe-mobile flex-1 p-4 pb-24 md:pb-4 md:pl-6 md:pr-6">
        {children}
      </main>
      <nav
        className="dashboard-bottom-nav-safe fixed bottom-0 left-0 right-0 z-20 flex px-2 pb-2 min-[360px]:px-3 md:hidden"
        aria-label="Main"
      >
        <DashboardNav user={user} mobile />
      </nav>
    </div>
  );
}
