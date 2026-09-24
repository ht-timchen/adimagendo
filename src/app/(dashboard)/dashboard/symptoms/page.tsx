import { auth } from "@/auth";
import { SymptomDiary } from "@/components/symptom-diary";
import { requireActiveParticipantPage } from "@/lib/participant-page-access";
import {
  participantDashboardPageClassName,
  participantDashboardPageTitleClassName,
} from "@/lib/participant-dashboard-ui";

export default async function SymptomsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireActiveParticipantPage(session);

  return (
    <div className={participantDashboardPageClassName}>
      <div>
        <h1 className={participantDashboardPageTitleClassName}>Symptom diary</h1>
        <p className="text-[#17483F]">
          Log your symptoms by day. Select a date on the calendar to add or edit an entry.
        </p>
      </div>
      <SymptomDiary />
    </div>
  );
}
