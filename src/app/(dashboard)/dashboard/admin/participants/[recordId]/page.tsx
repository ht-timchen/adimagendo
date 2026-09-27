import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { lastActiveTimestamp } from "@/lib/admin-display";
import { computeAdminChecklistProgress } from "@/lib/admin/checklist-progress";
import { getValidChecklistTemplateIds } from "@/lib/valid-checklist-items";
import { hasPermission } from "@/lib/admin-rbac";
import { getParticipantAccessDisabledReason } from "@/lib/admin/participant-access-disabled-reason";
import {
  countChecklistOverdue,
  deriveJoinStatus,
  deriveStudyStatus,
  formatAdminDateDMY,
  formatAdminDateTimeDMY,
  hasParticipantChecklistActivity,
} from "@/lib/admin/participant-detail-status";
import { ParticipantDetailClient } from "@/components/admin/participant-detail-client";
import type { ParticipantClassificationCardData } from "@/components/admin/participant-data-classification-card";
import {
  isTestParticipantForTiming,
  resolveEnrollmentDateForTiming,
} from "@/lib/checklist/enrollment-date-for-timing";
import {
  adelaideCivilDate,
  formatAdelaideCivilDate,
  formatCivilDateYmd,
} from "@/lib/dates/adelaide-calendar";
import {
  canMarkAsPilotParticipant,
  participantClassificationBadge,
} from "@/lib/participant/pilot-participant-scope";
import {
  canMarkAsTestParticipant,
  canUnmarkTestParticipant,
  classificationLockedReason,
} from "@/lib/participant/classification-eligibility";
import { getParticipantClassificationHistory } from "@/lib/participant/classification-history";
import {
  isTestEnrollmentDateToolsEnabled,
  TEST_ENROLLMENT_DATE_MIN,
  testEnrollmentDateMax,
} from "@/lib/participant/test-enrollment-date";

const DATA_SOURCE_LABELS = { LOCAL: "Local", REDCAP: "REDCap" } as const;
const DATA_KIND_LABELS = { TEST: "Test", REAL: "Pilot", UNKNOWN: "Unknown" } as const;

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
      studyRecordId: true,
      dataSource: true,
      dataKind: true,
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
  const canClassify = hasPermission(session, "participant:classify");
  const [redcapSync, tokens, lastActive, accessDisabledReason, day0Timing, history] = await Promise.all([
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
    resolveEnrollmentDateForTiming(profile),
    canClassify ? getParticipantClassificationHistory(user.id) : Promise.resolve([]),
  ]);

  const day0Civil =
    day0Timing.missing || !day0Timing.enrollmentDate
      ? null
      : adelaideCivilDate(day0Timing.enrollmentDate);
  const day0Label = day0Civil ? formatAdelaideCivilDate(day0Civil) : null;

  let classification: ParticipantClassificationCardData | undefined;
  if (canClassify) {
    const badge = participantClassificationBadge(profile);
    classification = {
      userId: user.id,
      sourceLabel: DATA_SOURCE_LABELS[profile.dataSource],
      typeLabel: DATA_KIND_LABELS[profile.dataKind],
      typeClassName: badge.className,
      canMarkTest: canMarkAsTestParticipant(profile),
      canMarkPilot:
        hasPermission(session, "participant:mark_pilot") && canMarkAsPilotParticipant(profile),
      canUnmarkTest: canUnmarkTestParticipant(profile),
      lockedReason: classificationLockedReason(profile),
      isTestAccount: isTestParticipantForTiming(profile),
      testDateToolsEnabled: isTestEnrollmentDateToolsEnabled(),
      day0Label,
      day0Ymd: day0Civil ? formatCivilDateYmd(day0Civil) : null,
      minDateYmd: formatCivilDateYmd(TEST_ENROLLMENT_DATE_MIN),
      maxDateYmd: formatCivilDateYmd(testEnrollmentDateMax(new Date())),
      history,
    };
  }

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
        day0: day0Label ?? "Missing",
        permissions: {
          canResetPassword: hasPermission(session, "participant:reset_password"),
          canSendNotification: hasPermission(session, "notification:send"),
          canManageEnrolment: hasPermission(session, "enrolment:manage"),
          canUpdateParticipant: hasPermission(session, "participant:update"),
        },
        classification,
      }}
    />
  );
}
