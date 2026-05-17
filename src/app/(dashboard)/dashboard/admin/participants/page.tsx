import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { displayStudyRecordId, participantEngagementStatus } from "@/lib/admin-display";
import { summarizeParticipantChecklist } from "@/lib/participant-checklist-summary";
import { getValidChecklistTemplateIds } from "@/lib/valid-checklist-items";
import {
  AdminParticipantsTable,
  type ParticipantRow,
} from "@/components/admin-participants-table";

function formatDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AdminParticipantsPage() {
  const validTemplateIds = await getValidChecklistTemplateIds();
  const checklistScope =
    validTemplateIds.length > 0
      ? { templateId: { in: validTemplateIds } }
      : { templateId: { in: [] as string[] } };

  const users = await prisma.user.findMany({
    where: { role: "PARTICIPANT" },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      dateOfBirth: true,
      profile: {
        select: {
          enrollmentDate: true,
          studyRecordId: true,
        },
      },
      checklist: {
        where: checklistScope,
        select: {
          status: true,
          template: { select: { title: true, sortOrder: true } },
        },
        orderBy: { template: { sortOrder: "asc" } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const participants: ParticipantRow[] = users.map((u) => {
    const checklist = summarizeParticipantChecklist(u.checklist);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      recordId: displayStudyRecordId(u.profile, u.id),
      enrollmentDate: formatDate(u.profile?.enrollmentDate),
      dateOfBirth: formatDate(u.dateOfBirth),
      checklistCompleted: checklist.completed,
      checklistTotal: checklist.total,
      currentStep: checklist.currentStep,
      status: participantEngagementStatus(u.isActive),
    };
  });

  return (
    <div className="mx-auto max-w-[90rem] space-y-6">
      <div className="space-y-3">
        <Link
          href="/dashboard/admin"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" /> Back to overview
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Participants</h1>
          <p className="text-slate-600 dark:text-slate-400">
            View enrollment, study status, and checklist progress. Reset passwords or send push notifications.
          </p>
        </div>
      </div>

      <AdminParticipantsTable participants={participants} />
    </div>
  );
}
