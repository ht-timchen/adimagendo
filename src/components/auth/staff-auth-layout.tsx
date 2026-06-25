import type { ReactNode } from "react";

/** Plain auth shell for admin/staff sign-in — no participant illustrated background. */
export function StaffAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      {children}
    </div>
  );
}
