"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  CalendarClock,
  ClipboardList,
  FileText,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Menu,
  MoreHorizontal,
  Newspaper,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isAdminDashboardRole } from "@/lib/admin-rbac";
import { Button } from "@/components/ui/button";

const participantPrimaryTabs = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/checklist", label: "Checklist", icon: ListChecks },
  {
    href: "/dashboard/appointments",
    label: "Appointments",
    icon: CalendarClock,
  },
  { href: "/dashboard/symptoms", label: "Symptoms", icon: Activity },
] as const;

const participantMoreItems = [
  { href: "/dashboard/absences", label: "Diary", icon: BookOpen },
  { href: "/dashboard/surveys", label: "Surveys", icon: ClipboardList },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/contact", label: "Contact", icon: Mail },
  { href: "/dashboard/news", label: "News", icon: Newspaper },
] as const;

const adminNavItem = { href: "/dashboard/admin", label: "Admin", icon: Shield };

const moreHrefs = new Set(
  participantMoreItems.map((item) => item.href)
);

function isPrimaryActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isMoreActive(pathname: string): boolean {
  return [...moreHrefs].some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  );
}

function NavTabLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
        active
          ? "text-violet-600 dark:text-violet-400"
          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="max-w-[4.5rem] truncate">{label}</span>
    </Link>
  );
}

export function DashboardNav({
  user,
  mobile,
}: {
  user: { name?: string | null; email?: string | null; role?: string };
  mobile?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const isAdminUser = isAdminDashboardRole(user.role);
  const [moreOpen, setMoreOpen] = useState(false);
  const [desktopMoreOpen, setDesktopMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
    setDesktopMoreOpen(false);
  }, [pathname]);

  if (mobile) {
    return (
      <>
        {moreOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-20 bg-black/25 md:hidden"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
        ) : null}
        {moreOpen ? (
          <div
            className="dashboard-bottom-nav-safe fixed bottom-16 left-0 right-0 z-30 border-t border-slate-200 bg-white px-2 py-2 shadow-lg dark:border-slate-800 dark:bg-slate-900 md:hidden"
            role="menu"
            aria-label="More"
          >
            <div className="grid grid-cols-2 gap-1">
              {participantMoreItems.map((item) => {
                const Icon = item.icon;
                const active = isPrimaryActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="flex w-full justify-around py-2">
          {participantPrimaryTabs.map((item) => (
            <NavTabLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isPrimaryActive(pathname, item.href)}
            />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
              isMoreActive(pathname) || moreOpen
                ? "text-violet-600 dark:text-violet-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            )}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </>
    );
  }

  const desktopItems = [
    ...(isAdminUser ? [adminNavItem] : []),
    ...participantPrimaryTabs,
  ];

  return (
    <div className="flex items-center gap-2">
      <div className="hidden gap-1 md:flex">
        {desktopItems.map((item) => {
          const Icon = item.icon;
          const active = isPrimaryActive(pathname, item.href);
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  active &&
                    "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200"
                )}
              >
                <Icon className="mr-1 h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}
        <div className="relative">
          <Button
            type="button"
            variant={
              isMoreActive(pathname) || desktopMoreOpen ? "secondary" : "ghost"
            }
            size="sm"
            className={cn(
              (isMoreActive(pathname) || desktopMoreOpen) &&
                "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200"
            )}
            onClick={() => setDesktopMoreOpen((open) => !open)}
            aria-expanded={desktopMoreOpen}
            aria-haspopup="menu"
          >
            <Menu className="mr-1 h-4 w-4" />
            More
          </Button>
          {desktopMoreOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Close menu"
                onClick={() => setDesktopMoreOpen(false)}
              />
              <div
                className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                role="menu"
              >
                {participantMoreItems.map((item) => {
                  const Icon = item.icon;
                  const active = isPrimaryActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800",
                        active && "text-violet-700 dark:text-violet-300"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </div>
      <span className="text-sm text-slate-500 dark:text-slate-400">
        {user.name ?? user.email}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Sign out"
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
