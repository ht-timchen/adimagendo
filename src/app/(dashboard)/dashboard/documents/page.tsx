import { auth } from "@/auth";
import { DocumentsSection } from "@/components/documents-section";
import { requireActiveParticipantPage } from "@/lib/participant-page-access";
import {
  participantDashboardPageClassName,
  participantDashboardPageTitleClassName,
} from "@/lib/participant-dashboard-ui";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireActiveParticipantPage(session);

  return (
    <div className={participantDashboardPageClassName}>
      <div>
        <h1 className={participantDashboardPageTitleClassName}>Documents</h1>
        <p className="text-[#17483F]">
          Upload report cards and view referrals sent to you.
        </p>
      </div>
      <DocumentsSection />
    </div>
  );
}
