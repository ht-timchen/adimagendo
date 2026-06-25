import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { displayStudyRecordId, participantEngagementStatus } from "@/lib/admin-display";
import { computeAdminChecklistProgress } from "@/lib/admin/checklist-progress";
import { isLevel1FollowUpDue } from "@/lib/checklist/level1-follow-up";
import { getValidChecklistTemplateIds } from "@/lib/valid-checklist-items";
import {
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
import { hasPermission } from "@/lib/admin-rbac";

function formatDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const CLASSIFICATION_FILTERS: ParticipantClassificationFilter[] = [
  "all",
  "test",
  "pilot",
  "unknown",
];

export default async function AdminParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ classification?: string; q?: string }>;
}) {
  const session = await auth();
  const { classification: classificationParam, q: searchQuery } = await searchParams;
  const classificationFilter: ParticipantClassificationFilter =
    classificationParam == null || classificationParam === ""
      ? "all"
      : parseParticipantClassificationFilter(classificationParam);
  const recordIdQuery = searchQuery?.trim().toLowerCase() ?? "";

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
        studyRecordId: profile.studyRecordId?.trim() || null,
        isActive: u.isActive,
        enrollmentDate: formatDate(profile.enrollmentDate),
        dateOfBirth: formatDate(u.dateOfBirth),
        checklistCompleted: progress.completed,
        checklistTotal: progress.total,
        currentStep: progress.currentStepName,
        status: participantEngagementStatus(u.isActive),
        level1FollowUpDue,
        classificationLabel: badge.label,
        classificationClassName: badge.className,
      };
    })
    .filter((p) => {
      if (!recordIdQuery) return true;
      const recordId = p.recordId.toLowerCase();
      const studyRecordId = p.studyRecordId?.toLowerCase() ?? "";
      return recordId.includes(recordIdQuery) || studyRecordId.includes(recordIdQuery);
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
            Browse enrolled participants. Click a record ID to open full details.
          </p>
        </div>
      </div>

      <ParticipantClassificationTabs
        current={classificationFilter}
        counts={filterCounts}
        recordIdQuery={searchQuery?.trim() ?? ""}
      />

      <AdminParticipantsTable
        participants={participants}
        classificationFilter={classificationFilter}
        recordIdQuery={searchQuery?.trim() ?? ""}
        permissions={{
          canResetPassword: hasPermission(session, "participant:reset_password"),
          canSendNotification: hasPermission(session, "notification:send"),
          canManageEnrolment: hasPermission(session, "enrolment:manage"),
          canUpdateParticipant: hasPermission(session, "participant:update"),
        }}
      />
    </div>
  );
}
