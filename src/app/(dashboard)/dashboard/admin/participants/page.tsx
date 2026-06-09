import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { displayStudyRecordId, participantEngagementStatus } from "@/lib/admin-display";
import { computeAdminChecklistProgress } from "@/lib/admin/checklist-progress";
import { isLevel1FollowUpDue } from "@/lib/checklist/level1-follow-up";
import { getValidChecklistTemplateIds } from "@/lib/valid-checklist-items";
import {
  canMarkAsPilotParticipant,
  isPilotParticipant,
  parseParticipantClassificationFilter,
  participantClassificationBadge,
  pilotParticipantUserWhere,
  type ParticipantClassificationFilter,
} from "@/lib/participant/pilot-participant-scope";
import { ParticipantClassificationTabs } from "@/components/admin/participant-classification-tabs";
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

const CLASSIFICATION_FILTERS: ParticipantClassificationFilter[] = [
  "pilot",
  "test",
  "unknown",
  "all",
];

export default async function AdminParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ classification?: string }>;
}) {
  const { classification: classificationParam } = await searchParams;
  const classificationFilter = parseParticipantClassificationFilter(
    classificationParam
  );

  const validTemplateIds = await getValidChecklistTemplateIds();
  const checklistScope =
    validTemplateIds.length > 0
      ? { templateId: { in: validTemplateIds } }
      : { templateId: { in: [] as string[] } };

  const [filterCountsList, users] = await Promise.all([
    Promise.all(
      CLASSIFICATION_FILTERS.map(async (filter) => ({
        filter,
        count: await prisma.user.count({
          where: pilotParticipantUserWhere(filter),
        }),
      }))
    ),
    prisma.user.findMany({
      where: pilotParticipantUserWhere(classificationFilter),
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
            dataSource: true,
            dataKind: true,
          },
        },
        checklist: {
          where: checklistScope,
          select: {
            status: true,
            template: { select: { key: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const filterCounts = Object.fromEntries(
    filterCountsList.map(({ filter, count }) => [filter, count])
  ) as Record<ParticipantClassificationFilter, number>;

  const participants: ParticipantRow[] = users
    .filter((u) => u.profile != null)
    .map((u) => {
      const profile = u.profile!;
      const progress = computeAdminChecklistProgress(
        u.checklist.map((item) => ({
          templateKey: item.template.key,
          status: item.status,
        }))
      );
      const completedKeys = new Set(
        u.checklist
          .filter((item) => item.status === "COMPLETED")
          .map((item) => item.template.key)
      );
      const level1FollowUpDue =
        isPilotParticipant(profile) &&
        profile.enrollmentDate != null &&
        isLevel1FollowUpDue({
          enrollmentDate: profile.enrollmentDate,
          completedTemplateKeys: completedKeys,
        });

      const badge = participantClassificationBadge(profile);

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        recordId: displayStudyRecordId(profile, u.id),
        enrollmentDate: formatDate(profile.enrollmentDate),
        dateOfBirth: formatDate(u.dateOfBirth),
        checklistCompleted: progress.completed,
        checklistTotal: progress.total,
        currentStep: progress.currentStepName,
        status: participantEngagementStatus(u.isActive),
        level1FollowUpDue,
        classificationLabel: badge.label,
        classificationClassName: badge.className,
        canMarkAsPilot: canMarkAsPilotParticipant(profile),
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Participants
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            View enrollment, study status, and checklist progress. Level 1
            follow-up applies to pilot participants only.
          </p>
        </div>
      </div>

      <ParticipantClassificationTabs
        current={classificationFilter}
        counts={filterCounts}
      />

      <AdminParticipantsTable participants={participants} />
    </div>
  );
}
