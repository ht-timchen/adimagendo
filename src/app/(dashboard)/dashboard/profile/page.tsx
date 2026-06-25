import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PushNotificationOptIn } from "@/components/push-notification-opt-in";
import { ParticipantProfileAccountActions } from "@/components/participant-profile-account-actions";
import { ParticipantProfileDetailRow } from "@/components/participant-profile-detail-row";
import { isAdminDashboardRole } from "@/lib/admin-rbac";
import {
  formatParticipantProfileDate,
  formatParticipantProfileText,
} from "@/lib/participant-profile-display";
import {
  participantDashboardCardClassName,
  participantDashboardHeadingClassName,
  participantDashboardMutedClassName,
  participantDashboardPageClassName,
  participantDashboardPageTitleClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";
import { ChevronRight, Mail } from "lucide-react";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (isAdminDashboardRole(session)) {
    redirect("/dashboard/admin");
  }

  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        dateOfBirth: true,
      },
    }),
    prisma.participantProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        enrollmentDate: true,
        studyPhase: true,
        studyRecordId: true,
      },
    }),
  ]);

  const studyRecordId = profile?.studyRecordId?.trim();
  const redcapSync = studyRecordId
    ? await prisma.redcapParticipantSync.findUnique({
        where: { studyRecordId },
        select: { dateOfBirth: true },
      })
    : null;

  const dateOfBirth = redcapSync?.dateOfBirth ?? user?.dateOfBirth;

  return (
    <div className={participantDashboardPageClassName}>
      <div>
        <h1 className={participantDashboardPageTitleClassName}>Profile</h1>
        <p className={cn("text-sm", participantDashboardMutedClassName)}>
          Your account and study details.
        </p>
      </div>

      <Card className={participantDashboardCardClassName}>
        <CardHeader className="pb-2">
          <CardTitle className={cn("text-base", participantDashboardHeadingClassName)}>
            My details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <ParticipantProfileDetailRow
              label="Name"
              value={formatParticipantProfileText(user?.name)}
            />
            <ParticipantProfileDetailRow
              label="Email"
              value={formatParticipantProfileText(user?.email)}
            />
            <ParticipantProfileDetailRow
              label="Date of birth"
              value={formatParticipantProfileDate(dateOfBirth)}
            />
          </dl>
        </CardContent>
      </Card>

      <Card className={participantDashboardCardClassName}>
        <CardHeader className="pb-2">
          <CardTitle className={cn("text-base", participantDashboardHeadingClassName)}>
            My study
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <ParticipantProfileDetailRow
              label="Enrollment date"
              value={formatParticipantProfileDate(profile?.enrollmentDate)}
            />
            <ParticipantProfileDetailRow
              label="Study phase"
              value={formatParticipantProfileText(profile?.studyPhase)}
            />
          </dl>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className={cn("text-base font-semibold", participantDashboardHeadingClassName)}>
          Notifications
        </h2>
        <PushNotificationOptIn />
      </section>

      <Card className={participantDashboardCardClassName}>
        <CardHeader className="pb-2">
          <CardTitle className={cn("text-base", participantDashboardHeadingClassName)}>
            Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ParticipantProfileAccountActions />
        </CardContent>
      </Card>

      <Card className={participantDashboardCardClassName}>
        <CardHeader className="pb-2">
          <CardTitle className={cn("text-base", participantDashboardHeadingClassName)}>
            Help
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard/contact"
            className="flex items-center justify-between rounded-lg border border-[#2F8F7A]/20 bg-white/70 px-4 py-3 text-sm font-medium text-[#17483F] transition-colors hover:bg-[#f1faf7]"
          >
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-[#2F8F7A]" />
              Contact study team
            </span>
            <ChevronRight className="h-4 w-4 text-[#1F5C50]" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
