"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import {
  Bell,
  ChevronRight,
  ClipboardCheck,
  FileDown,
  FileUp,
  LayoutDashboard,
  Link as LinkIcon,
  ListChecks,
  LogOut,
  Mail,
  Newspaper,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { AppBrandLogo } from "@/components/brand/app-brand-logo";

export type ClinicalAdminShellUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: string;
  superAdmin?: boolean;
  canViewStaffList: boolean;
  canViewSettings: boolean;
  canViewImport: boolean;
  canViewExport: boolean;
  canViewNotifications: boolean;
  canViewEnrolment: boolean;
};

const mainNav = [
  { href: "/dashboard/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/admin/participants", label: "Participants", icon: Users },
  { href: "/dashboard/admin/participant-progress", label: "Participant Progress", icon: ListChecks },
  { href: "/dashboard/admin/checklist-completion", label: "Checklist Completion", icon: ClipboardCheck },
  { href: "/dashboard/admin/news", label: "New Posts", icon: Newspaper },
  { href: "/dashboard/admin/messages", label: "Contact Messages", icon: Mail },
  { href: "/dashboard/admin/people", label: "People", icon: UsersRound },
  { href: "/dashboard/admin/settings", label: "Settings", icon: Settings },
] as const;

const actionNav = [
  { href: "/dashboard/admin/actions/import", label: "Import CSV file", icon: FileUp },
  { href: "/dashboard/admin/actions/export", label: "Export CSV file", icon: FileDown },
  { href: "/dashboard/admin/actions/notify", label: "Send notifications", icon: Bell },
  { href: "/dashboard/admin/actions/enrolment", label: "Enrolment Links", icon: LinkIcon },
] as const;

const adminMobileTabs = [
  { href: "/dashboard/admin/participants", label: "Participants", icon: Users },
  {
    href: "/dashboard/admin/actions/notify",
    label: "Notifications",
    icon: Bell,
  },
] as const;

function adminMobileTabActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard/admin") {
    return pathname === "/dashboard/admin" || pathname === "/dashboard/admin/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNav({
  pathname,
  actionsOpen,
  setActionsOpen,
  user,
  compact,
}: {
  pathname: string;
  actionsOpen: boolean;
  setActionsOpen: (v: boolean) => void;
  user: ClinicalAdminShellUser;
  compact?: boolean;
}) {
  const allowedMainNav = mainNav.filter((item) => {
    if (item.href === "/dashboard/admin/people") return user.canViewStaffList;
    if (item.href === "/dashboard/admin/settings") return user.canViewSettings;
    return true;
  });
  const allowedActionNav = actionNav.filter((item) => {
    if (item.href === "/dashboard/admin/actions/import") return user.canViewImport;
    if (item.href === "/dashboard/admin/actions/export") return user.canViewExport;
    if (item.href === "/dashboard/admin/actions/notify") return user.canViewNotifications;
    if (item.href === "/dashboard/admin/actions/enrolment") return user.canViewEnrolment;
    return true;
  });

  return (
    <div className={cn("flex flex-col gap-1", compact && "max-h-[42vh] overflow-y-auto")}>
      {allowedMainNav.map((item) => {
        const Icon = item.icon;
        const active = navItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" }),
              "justify-start gap-2 rounded-xl",
              active && "bg-brand-surface text-brand dark:bg-brand/20 dark:text-brand",
              compact && "text-xs"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}

      {allowedActionNav.length > 0 ? (
      <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActionsOpen(!actionsOpen)}
          className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/80"
        >
          <ChevronRight
            className={cn("h-4 w-4 shrink-0 transition-transform", actionsOpen && "rotate-90")}
            aria-hidden
          />
          Actions
        </button>
        {actionsOpen ? (
          <div className="mt-1 flex flex-col gap-1 pl-1">
            {allowedActionNav.map((item) => {
              const Icon = item.icon;
              const active = navItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  className={cn(
                    buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" }),
                    "justify-start gap-2 rounded-xl pl-4",
                    active && "bg-brand-surface text-brand dark:bg-brand/20 dark:text-brand",
                    compact && "text-xs"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}

export function ClinicalAdminShell({
  user,
  children,
}: {
  user: ClinicalAdminShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [actionsOpen, setActionsOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="hidden shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex md:w-60 md:flex-col md:border-b-0 md:border-r">
        <div className="flex justify-center px-2 py-3">
          <AppBrandLogo size="sidebar" href="/dashboard/admin" priority />
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto border-t border-slate-100 p-3 dark:border-slate-800">
          <SidebarNav
            pathname={pathname}
            actionsOpen={actionsOpen}
            setActionsOpen={setActionsOpen}
            user={user}
          />
        </nav>
        <div className="border-t border-slate-100 p-3 dark:border-slate-800">
          <p className="truncate px-2 text-xs text-slate-500">{user.name ?? user.email}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 w-full justify-start gap-2 text-slate-600"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-2 dark:border-slate-800 dark:bg-slate-900 md:hidden">
          <AppBrandLogo size="header" href="/dashboard/admin" priority />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </header>
        <main className="dashboard-main-safe-mobile min-h-0 flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-6">
          {children}
        </main>
        <nav
          className="dashboard-bottom-nav-safe fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:hidden"
          aria-label="Main navigation"
        >
          <div className="flex w-full justify-around py-2">
            {adminMobileTabs
              .filter((item) => {
                if (item.href === "/dashboard/admin/actions/notify") {
                  return user.canViewNotifications;
                }
                return true;
              })
              .map((item) => {
              const Icon = item.icon;
              const active = adminMobileTabActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg px-4 py-1 text-xs font-medium transition-colors",
                    active
                      ? "text-brand dark:text-brand"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
