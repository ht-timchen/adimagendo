import type { Session } from "next-auth";
import type { ParticipantDataKind, ParticipantDataSource } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Synthetic fixtures for classification tests. Call cleanup() in after(). */
export function createClassificationFixtures(prefix: string) {
  const userIds: string[] = [];
  const syncRecordIds: string[] = [];

  function uniqueSuffix(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  function uniqueRecordId(recordPrefix = "CLS"): string {
    return `${recordPrefix}-${prefix}-${uniqueSuffix()}`;
  }

  async function createStaff(options: {
    role?: "ADMIN" | "USER";
    superAdmin: boolean;
    isActive?: boolean;
  }): Promise<Session> {
    const role = options.role ?? "ADMIN";
    const user = await prisma.user.create({
      data: {
        email: `${prefix}-staff-${uniqueSuffix()}@example.com`,
        name: `Test ${options.superAdmin ? "Super Admin" : role}`,
        role,
        superAdmin: options.superAdmin,
        isActive: options.isActive ?? true,
      },
      select: { id: true, email: true, name: true },
    });
    userIds.push(user.id);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: options.superAdmin ? "SUPER_ADMIN" : role,
        active: options.isActive ?? true,
        superAdmin: options.superAdmin,
      },
      expires: new Date(Date.now() + 60_000).toISOString(),
    };
  }

  /** Session that claims SUPER_ADMIN for a user who is not one in the database. */
  function staleSuperAdminSession(session: Session): Session {
    return {
      ...session,
      user: { ...session.user, role: "SUPER_ADMIN", superAdmin: true },
    };
  }

  async function createParticipant(options: {
    dataSource: ParticipantDataSource;
    dataKind: ParticipantDataKind;
    enrollmentDate: Date;
    studyRecordId?: string | null;
  }): Promise<{ userId: string; profileId: string; studyRecordId: string | null }> {
    const studyRecordId =
      options.studyRecordId === undefined ? uniqueRecordId() : options.studyRecordId;
    const user = await prisma.user.create({
      data: {
        email: `${prefix}-participant-${uniqueSuffix()}@example.com`,
        role: "PARTICIPANT",
        isActive: true,
        profile: {
          create: {
            enrollmentDate: options.enrollmentDate,
            studyRecordId,
            dataSource: options.dataSource,
            dataKind: options.dataKind,
          },
        },
      },
      select: { id: true, profile: { select: { id: true } } },
    });
    userIds.push(user.id);
    return { userId: user.id, profileId: user.profile!.id, studyRecordId };
  }

  async function createSyncRow(studyRecordId: string, enrollmentDate: Date | null) {
    await prisma.redcapParticipantSync.create({
      data: { studyRecordId, enrollmentDate, consentStatus: "complete" },
    });
    syncRecordIds.push(studyRecordId);
  }

  async function getProfile(userId: string) {
    return prisma.participantProfile.findUniqueOrThrow({
      where: { userId },
      select: { dataSource: true, dataKind: true, enrollmentDate: true },
    });
  }

  async function getAuditEvents(userId: string) {
    return prisma.adminAuditEvent.findMany({
      where: { targetType: "participant", targetId: userId },
      orderBy: { createdAt: "asc" },
    });
  }

  async function cleanup(): Promise<void> {
    if (userIds.length > 0) {
      await prisma.adminAuditEvent.deleteMany({
        where: {
          OR: [{ targetId: { in: userIds } }, { actorUserId: { in: userIds } }],
        },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (syncRecordIds.length > 0) {
      await prisma.redcapParticipantSync.deleteMany({
        where: { studyRecordId: { in: syncRecordIds } },
      });
    }
    await prisma.$disconnect();
  }

  return {
    uniqueRecordId,
    createStaff,
    staleSuperAdminSession,
    createParticipant,
    createSyncRow,
    getProfile,
    getAuditEvents,
    cleanup,
  };
}
