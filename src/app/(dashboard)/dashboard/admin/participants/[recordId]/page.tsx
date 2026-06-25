import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { lastActiveTimestamp } from "@/lib/admin-display";
import { computeAdminChecklistProgress } from "@/lib/admin/checklist-progress";
import { getValidChecklistTemplateIds } from "@/lib/valid-checklist-items";
import { hasPermission } from "@/lib/admin-rbac";
import {
  countChecklistOverdue,
  deriveJoinStatus,
  deriveStudyStatus,
  formatAdminDateDMY,
  formatAdminDateTimeDMY,
  getParticipantAccessDisabledReason,
  hasParticipantChecklistActivity,
} from "@/lib/admin/participant-detail-status";
import { ParticipantDetailClient } from "@/components/admin/participant-detail-client";

export default async function AdminParticipantDetailPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!hasPermission(session, "participant:read")) {
    redirect("/dashboard/admin");
  }

  const { recordId } = await params;
  const studyRecordId = recordId.trim();
  if (!studyRecordId) {
    notFound();
  }

  const validTemplateIds = await getValidChecklistTemplateIds();
  const checklistScope =
    validTemplateIds.length > 0
      ? { templateId: { in: validTemplateIds } }
      : { templateId: { in: [] as string[] } };

  const profile = await prisma.participantProfile.findUnique({
    where: { studyRecordId },
    select: {
      enrollmentDate: true,
      redcapType: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          dateOfBirth: true,
          lastLoginAt: true,
          checklist: {
            where: checklistScope,
            select: {
              status: true,
              bookingProgress: true,
              template: { select: { key: true } },
            },
          },
          _count: { select: { appointments: true } },
        },
      },
    },
  });

  if (!profile) {
    notFound();
  }

  const user = profile.user;
  const [redcapSync, tokens, lastActive, accessDisabledReason] = await Promise.all([
    prisma.redcapParticipantSync.findUnique({
      where: { studyRecordId },
      select: { email: true, dateOfBirth: true, redcapType: true },
    }),
    prisma.enrolmentToken.findMany({
      where: { studyRecordId },
      select: { usedAt: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    }),
    lastActiveTimestamp(user.id),
    user.isActive ? Promise.resolve(null) : getParticipantAccessDisabledReason(user.id),
  ]);

  const checklistItems = user.checklist.map((item) => ({
    templateKey: item.template.key,
    status: item.status,
    bookingProgress: item.bookingProgress,
  }));

  const progress = computeAdminChecklistProgress(
    checklistItems.map((item) => ({
      templateKey: item.templateKey,
      status: item.status,
    }))
  );
  const overdue = countChecklistOverdue(checklistItems);
  const hasActivity = hasParticipantChecklistActivity(
    checklistItems,
    user._count.appointments > 0
  );

  const joinStatus = deriveJoinStatus({
    isActive: user.isActive,
    hasBoundAccount: true,
    tokens,
  });

  const studyStatus = deriveStudyStatus({
    isActive: user.isActive,
    checklistCompleted: progress.completed,
    checklistTotal: progress.total,
    hasChecklistActivity: hasActivity,
  });

  const redcapEmail = redcapSync?.email?.trim() || null;
  const registeredEmail = user.email.trim();
  const emailMismatch =
    redcapEmail != null &&
    redcapEmail.toLowerCase() !== registeredEmail.toLowerCase();

  const dobSource = redcapSync?.dateOfBirth ?? user.dateOfBirth;
  const redcapType = redcapSync?.redcapType ?? profile.redcapType;

  const lastActivityAt = lastActive ?? user.lastLoginAt;

  return (
    <ParticipantDetailClient
      data={{
        userId: user.id,
        studyRecordId,
        name: user.name,
        registeredEmail,
        redcapEmail,
        dateOfBirth: formatAdminDateDMY(dobSource),
        redcapType,
        emailMismatch,
        joinStatus,
        accessDisabledReason,
        studyStatus,
        checklistCompleted: progress.completed,
        checklistTotal: progress.total,
        checklistOverdue: overdue,
        lastActivity: formatAdminDateTimeDMY(lastActivityAt),
        enrolledDate: formatAdminDateDMY(profile.enrollmentDate),
        permissions: {
          canResetPassword: hasPermission(session, "participant:reset_password"),
          canSendNotification: hasPermission(session, "notification:send"),
          canManageEnrolment: hasPermission(session, "enrolment:manage"),
          canUpdateParticipant: hasPermission(session, "participant:update"),
        },
      }}
    />
  );
}
