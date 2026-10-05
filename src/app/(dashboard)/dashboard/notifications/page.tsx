import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireActiveParticipantPage } from "@/lib/participant-page-access";
import { listParticipantBroadcasts } from "@/lib/notifications/broadcast-notifications";
import { ParticipantNotificationList } from "@/components/participant-notification-list";
import {
  participantDashboardMutedClassName,
  participantDashboardPageClassName,
  participantDashboardPageTitleClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireActiveParticipantPage(session);

  // Always the signed-in user's own notifications, newest first.
  const fetched = await listParticipantBroadcasts(prisma, session.user.id, PAGE_SIZE + 1);
  const items = fetched.slice(0, PAGE_SIZE);
  const unread = items.filter((item) => !item.read).length;

  return (
    <div className={participantDashboardPageClassName}>
      <div>
        <h1 className={participantDashboardPageTitleClassName}>Notifications</h1>
        <p className="text-[#17483F]">
          Messages from the study team.
          {unread > 0 ? ` You have ${unread} unread.` : ""}
        </p>
      </div>

      <ParticipantNotificationList items={items} />

      {fetched.length > PAGE_SIZE ? (
        <p className={cn("text-center text-xs", participantDashboardMutedClassName)}>
          Showing your {PAGE_SIZE} most recent notifications.
        </p>
      ) : null}
    </div>
  );
}
