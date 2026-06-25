import { auth } from "@/auth";
import { AbsenceTracker } from "@/components/absence-tracker";
import {
  participantDashboardPageClassName,
  participantDashboardPageTitleClassName,
} from "@/lib/participant-dashboard-ui";

export default async function AbsencesPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return (
    <div className={participantDashboardPageClassName}>
      <div>
        <h1 className={participantDashboardPageTitleClassName}>Diary</h1>
        <p className="text-[#17483F]">
          Record days you were absent from work or school.
        </p>
      </div>
      <AbsenceTracker />
    </div>
  );
}
