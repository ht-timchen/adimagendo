"use client";

import { usePathname } from "next/navigation";
import { DashboardNav } from "@/components/dashboard-nav";

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
}: {
  children: React.ReactNode;
  user: ChromeUser;
}) {
  const pathname = usePathname() ?? "";
  const hideParticipantChrome = pathname.startsWith("/dashboard/admin");

  if (hideParticipantChrome) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">{children}</div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="font-semibold text-violet-700 dark:text-violet-400">ADIMAGENDO</span>
          <DashboardNav user={user} />
        </div>
      </header>
      <main className="dashboard-main-safe-mobile flex-1 p-4 pb-24 md:pb-4 md:pl-6 md:pr-6">
        {children}
      </main>
      <nav
        className="dashboard-bottom-nav-safe fixed bottom-0 left-0 right-0 z-10 flex border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:hidden"
        aria-label="Main"
      >
        <DashboardNav user={user} mobile />
      </nav>
    </div>
  );
}
