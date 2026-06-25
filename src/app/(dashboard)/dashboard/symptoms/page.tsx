import { auth } from "@/auth";
import { SymptomDiary } from "@/components/symptom-diary";
import {
  participantDashboardPageClassName,
  participantDashboardPageTitleClassName,
} from "@/lib/participant-dashboard-ui";

export default async function SymptomsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

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
