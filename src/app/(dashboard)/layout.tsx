import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardNav } from "@/components/dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="font-semibold text-violet-700 dark:text-violet-400">
            ADIMAGENDO
          </span>
          <DashboardNav user={session.user} />
        </div>
      </header>
      <main className="flex-1 p-4 pb-24 md:pb-4 md:pl-6 md:pr-6">
        {children}
      </main>
      <nav
        className="fixed bottom-0 left-0 right-0 z-10 flex border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:hidden"
        aria-label="Main"
      >
        <DashboardNav user={session.user} mobile />
      </nav>
    </div>
  );
}
