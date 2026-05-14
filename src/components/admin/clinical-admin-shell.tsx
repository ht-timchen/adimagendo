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
  LogOut,
  Mail,
  Newspaper,
  PanelLeft,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

export type ClinicalAdminShellUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: string;
  superAdmin?: boolean;
};

const mainNav = [
  { href: "/dashboard/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/admin/participants", label: "Participants", icon: Users },
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
] as const;

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
  compact,
}: {
  pathname: string;
  actionsOpen: boolean;
  setActionsOpen: (v: boolean) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1", compact && "max-h-[42vh] overflow-y-auto")}>
      {mainNav.map((item) => {
        const Icon = item.icon;
        const active = navItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" }),
              "justify-start gap-2 rounded-xl",
              active && "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100",
              compact && "text-xs"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}

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
            {actionNav.map((item) => {
              const Icon = item.icon;
              const active = navItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  className={cn(
                    buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" }),
                    "justify-start gap-2 rounded-xl pl-4",
                    active && "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100",
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
      <aside className="hidden shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex md:w-56 md:flex-col md:border-b-0 md:border-r">
        <div className="flex h-14 items-center gap-2 border-b border-slate-100 px-4 dark:border-slate-800">
          <PanelLeft className="h-5 w-5 text-violet-600" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clinical</p>
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">Admin</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <SidebarNav
            pathname={pathname}
            actionsOpen={actionsOpen}
            setActionsOpen={setActionsOpen}
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
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 md:hidden">
          <span className="font-semibold text-violet-700 dark:text-violet-400">ADIMAGENDO</span>
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
        <div className="border-b border-slate-200 bg-white px-2 py-2 dark:border-slate-800 dark:bg-slate-900 md:hidden">
          <SidebarNav
            pathname={pathname}
            actionsOpen={actionsOpen}
            setActionsOpen={setActionsOpen}
            compact
          />
        </div>
        <main className="min-h-0 flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
