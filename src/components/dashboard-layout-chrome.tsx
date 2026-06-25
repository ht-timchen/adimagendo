"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardNav } from "@/components/dashboard-nav";
import { ParticipantBrandLogo } from "@/components/auth/participant-brand-logo";

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
    <div className="dashboard-participant-light light [color-scheme:light] relative isolate flex min-h-screen flex-col bg-slate-50">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/background-participant.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-white/50" />
      </div>
      <header className="relative sticky top-0 z-20 border-b border-[#2F8F7A]/20 bg-white/40 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3 px-2 md:px-3">
          <Link href="/dashboard" className="inline-flex shrink-0 focus-visible:outline-none">
            <ParticipantBrandLogo
              className="mx-0"
              sizeClassName="h-16 w-16"
              imageSrc="/images/adimagendo-mascot-transparent.png"
              priority
            />
          </Link>
          <DashboardNav user={user} />
        </div>
      </header>
      <main className="relative z-10 dashboard-main-safe-mobile flex-1 p-4 pb-24 md:pb-4 md:pl-6 md:pr-6">
        {children}
      </main>
      <nav
        className="dashboard-bottom-nav-safe fixed bottom-0 left-0 right-0 z-20 flex border-t border-[#2F8F7A]/20 bg-white/95 backdrop-blur md:hidden"
        aria-label="Main"
      >
        <DashboardNav user={user} mobile />
      </nav>
    </div>
  );
}
