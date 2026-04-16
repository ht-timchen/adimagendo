import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { AdminParticipantsTable } from "@/components/admin-participants-table";

export default async function AdminParticipantsPage() {
  const participants = await prisma.user.findMany({
    where: { role: "PARTICIPANT" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      profile: {
        select: {
          id: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/dashboard/admin"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" /> Back to overview
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Participants
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Send a test push notification to an individual participant.
          </p>
        </div>
      </div>

      <AdminParticipantsTable participants={participants} />
    </div>
  );
}
