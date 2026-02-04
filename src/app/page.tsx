import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-8 text-center">
        <h1 className="text-3xl font-bold text-violet-700 dark:text-violet-400">
          ADIMAGENDO
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Participant app for the ADIMAGENDO study. Sign in to access your
          checklist, symptom diary, surveys, and more.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-violet-600 px-8 text-sm font-medium text-white hover:bg-violet-700 sm:w-auto"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-8 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 sm:w-auto"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
