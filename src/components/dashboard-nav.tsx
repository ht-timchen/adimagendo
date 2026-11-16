"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  Activity,
  CalendarClock,
  FileText,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Menu,
  MoreHorizontal,
  Newspaper,
  NotebookPen,
  Shield,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isAdminDashboardRole } from "@/lib/admin-rbac";
import { Button } from "@/components/ui/button";
import { ParticipantNewsBell } from "@/components/participant-news-bell";
import { ParticipantNotificationsLink } from "@/components/participant-notifications-link";
import { participantFocusRingClassName } from "@/lib/participant-dashboard-ui";
import {
  PARTICIPANT_APPOINTMENTS_PATH,
  PARTICIPANT_CHECKLIST_PATH,
  PARTICIPANT_DIARY_PATH,
  PARTICIPANT_HOME_PATH,
  PARTICIPANT_PROFILE_PATH,
  PARTICIPANT_SYMPTOMS_PATH,
} from "@/lib/participant-routes";

type NavItem = { href: string; label: string; icon: LucideIcon };

const participantPrimaryTabs: readonly NavItem[] = [
  { href: PARTICIPANT_HOME_PATH, label: "Dashboard", icon: LayoutDashboard },
  { href: PARTICIPANT_CHECKLIST_PATH, label: "Checklist", icon: ListChecks },
  {
    href: PARTICIPANT_APPOINTMENTS_PATH,
    label: "Appointments",
    icon: CalendarClock,
  },
  { href: PARTICIPANT_SYMPTOMS_PATH, label: "Symptoms", icon: Activity },
];

const participantMoreItems: readonly NavItem[] = [
  { href: PARTICIPANT_PROFILE_PATH, label: "Profile", icon: User },
  { href: PARTICIPANT_DIARY_PATH, label: "Diary", icon: NotebookPen },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/contact", label: "Contact", icon: Mail },
  { href: "/dashboard/news", label: "News", icon: Newspaper },
  { href: "/dashboard/notifications", label: "Notifications", icon: Inbox },
];

const adminNavItem: NavItem = { href: "/dashboard/admin", label: "Admin", icon: Shield };

const moreHrefs = new Set(
  participantMoreItems.map((item) => item.href)
);

const NAV_ICON_STROKE = 1.5;

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

const mobileTabClassName =
  "flex flex-auto flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[12px] min-[360px]:text-[13px] font-medium leading-tight whitespace-nowrap transition-colors";
const mobileTabActiveClassName = "bg-participant-surface-strong text-participant-primary-active";
const mobileTabIdleClassName = "text-participant-muted hover:text-participant-ink";

function NavTabLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        mobileTabClassName,
        participantFocusRingClassName,
        active ? mobileTabActiveClassName : mobileTabIdleClassName
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={NAV_ICON_STROKE} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

const desktopTabClassName =
  "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors";
const desktopTabActiveClassName = "bg-participant-surface-strong text-participant-primary-active";
const desktopTabIdleClassName =
  "text-participant-ink hover:bg-participant-surface hover:text-participant-primary";

export function DashboardNav({
  user,
  mobile,
  newNewsCount = 0,
  showNewsBell = false,
  unreadNotificationCount = 0,
  showNotificationsLink = false,
  showProfileLink = false,
}: {
  user: { name?: string | null; email?: string | null; role?: string };
  mobile?: boolean;
  newNewsCount?: number;
  showNewsBell?: boolean;
  /** Participant-only: unread admin broadcasts (separate from the News count). */
  unreadNotificationCount?: number;
  showNotificationsLink?: boolean;
  /** Participant-only: name links to /dashboard/profile */
  showProfileLink?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const isAdminUser = isAdminDashboardRole(user.role);
  const [moreOpen, setMoreOpen] = useState(false);
  const [desktopMoreOpen, setDesktopMoreOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route-state sync: close mobile menu on any navigation including browser back/forward and programmatic route changes
    setMoreOpen(false);
    setDesktopMoreOpen(false);
  }, [pathname]);

  if (mobile) {
    const moreActive = isMoreActive(pathname) || moreOpen;
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
            className="dashboard-bottom-nav-safe fixed bottom-20 left-3 right-3 z-30 rounded-2xl border border-participant-primary/20 bg-participant-surface/95 px-2 py-2 shadow-lg backdrop-blur md:hidden"
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
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      participantFocusRingClassName,
                      active
                        ? "bg-participant-surface-strong text-participant-primary-active"
                        : "text-participant-ink hover:bg-participant-page"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={NAV_ICON_STROKE} aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="flex w-full gap-0.5 rounded-2xl border border-participant-primary/15 bg-participant-surface/95 p-1 shadow-(--participant-shadow) backdrop-blur">
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
              mobileTabClassName,
              participantFocusRingClassName,
              moreActive ? mobileTabActiveClassName : mobileTabIdleClassName
            )}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
          >
            <MoreHorizontal className="h-5 w-5" strokeWidth={NAV_ICON_STROKE} aria-hidden="true" />
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
  const desktopMoreActive = isMoreActive(pathname) || desktopMoreOpen;

  return (
    <div className="flex items-center gap-2">
      <div className="hidden gap-1 md:flex">
        {desktopItems.map((item) => {
          const Icon = item.icon;
          const active = isPrimaryActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                desktopTabClassName,
                participantFocusRingClassName,
                active ? desktopTabActiveClassName : desktopTabIdleClassName
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={NAV_ICON_STROKE} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
        <div className="relative">
          <button
            type="button"
            className={cn(
              desktopTabClassName,
              participantFocusRingClassName,
              desktopMoreActive ? desktopTabActiveClassName : desktopTabIdleClassName
            )}
            onClick={() => setDesktopMoreOpen((open) => !open)}
            aria-expanded={desktopMoreOpen}
            aria-haspopup="menu"
          >
            <Menu className="h-4 w-4" strokeWidth={NAV_ICON_STROKE} aria-hidden="true" />
            More
          </button>
          {desktopMoreOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Close menu"
                onClick={() => setDesktopMoreOpen(false)}
              />
              <div
                className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] rounded-xl border border-participant-primary/20 bg-participant-surface/95 p-1 shadow-lg backdrop-blur"
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
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                        participantFocusRingClassName,
                        active
                          ? "bg-participant-surface-strong font-medium text-participant-primary-active"
                          : "text-participant-ink hover:bg-participant-page"
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={NAV_ICON_STROKE} aria-hidden="true" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </div>
      {showNewsBell ? <ParticipantNewsBell newNewsCount={newNewsCount} /> : null}
      {showNotificationsLink ? (
        <ParticipantNotificationsLink unreadCount={unreadNotificationCount} />
      ) : null}
      {showProfileLink ? (
        <Link
          href={PARTICIPANT_PROFILE_PATH}
          className={cn(
            "max-w-[10rem] truncate rounded-sm text-sm text-participant-ink underline-offset-2",
            "hover:text-participant-primary hover:underline",
            participantFocusRingClassName
          )}
          aria-label="Open profile"
        >
          {user.name ?? user.email}
        </Link>
      ) : (
        <span className="max-w-[10rem] truncate text-sm text-participant-ink">
          {user.name ?? user.email}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-9 w-9 text-participant-ink hover:bg-participant-surface hover:text-participant-primary",
          participantFocusRingClassName
        )}
        aria-label="Sign out"
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        <LogOut className="h-4 w-4" strokeWidth={NAV_ICON_STROKE} aria-hidden="true" />
      </Button>
    </div>
  );
}
