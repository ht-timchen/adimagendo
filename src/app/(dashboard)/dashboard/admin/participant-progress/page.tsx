import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { displayStudyRecordId } from "@/lib/admin-display";
import {
  buildParticipantProgressRow,
  computeParticipantProgressKpis,
  sortParticipantProgressRows,
  type ChecklistTemplateMeta,
} from "@/lib/admin/participant-progress";
import { ParticipantProgressDashboard } from "@/components/admin/participant-progress-dashboard";
import { getValidChecklistTemplateIds } from "@/lib/valid-checklist-items";
import { hasPermission } from "@/lib/admin-rbac";

export default async function ParticipantProgressPage() {
  const session = await auth();
  const validTemplateIds = await getValidChecklistTemplateIds();
  const checklistScope =
    validTemplateIds.length > 0
      ? { templateId: { in: validTemplateIds } }
      : { templateId: { in: [] as string[] } };

  const [templates, users] = await Promise.all([
    prisma.checklistTemplate.findMany({
      select: {
        key: true,
        title: true,
        dueOffsetDays: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "PARTICIPANT" },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        profile: {
          select: {
            studyRecordId: true,
            enrollmentDate: true,
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
    }),
  ]);

  const templatesByKey = new Map<string, ChecklistTemplateMeta>(
    templates.map((t) => [
      t.key,
      {
        key: t.key,
        title: t.title,
        dueOffsetDays: t.dueOffsetDays,
      },
    ])
  );

  const rows = sortParticipantProgressRows(
    users.map((user) => {
      const profile = user.profile;
      const detailRecordId = displayStudyRecordId(profile, user.id);
      return buildParticipantProgressRow({
        id: user.id,
        name: user.name,
        email: user.email,
        studyRecordId: profile?.studyRecordId ?? null,
        detailRecordId,
        isActive: user.isActive,
        enrollmentDate: profile?.enrollmentDate ?? null,
        items: user.checklist.map((item) => ({
          templateKey: item.template.key,
          status: item.status,
        })),
        templatesByKey,
      });
    })
  );

  const kpis = computeParticipantProgressKpis(rows);

  return (
    <ParticipantProgressDashboard
      kpis={kpis}
      rows={rows}
      permissions={{
        canSendNotification: hasPermission(session, "notification:send"),
      }}
    />
  );
}
