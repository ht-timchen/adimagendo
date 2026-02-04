"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  ListChecks,
  Calendar,
  FileText,
  Mail,
  Newspaper,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/checklist", label: "Checklist", icon: ListChecks },
  { href: "/dashboard/symptoms", label: "Symptoms", icon: Calendar },
  { href: "/dashboard/absences", label: "Absences", icon: Calendar },
  { href: "/dashboard/surveys", label: "Surveys", icon: FileText },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/contact", label: "Contact", icon: Mail },
  { href: "/dashboard/news", label: "News", icon: Newspaper },
];

export function DashboardNav({
  user,
  mobile,
}: {
  user: { name?: string | null; email?: string | null };
  mobile?: boolean;
}) {
  const pathname = usePathname();

  if (mobile) {
    return (
      <div className="flex w-full justify-around py-2">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "text-violet-600 dark:text-violet-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden gap-1 md:flex">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  active && "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200"
                )}
              >
                <Icon className="mr-1 h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}
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
