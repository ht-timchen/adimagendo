import { auth } from "@/auth";
import { ContactForm } from "@/components/contact-form";
import { requireActiveParticipantPage } from "@/lib/participant-page-access";
import {
  participantDashboardPageClassName,
  participantDashboardPageTitleClassName,
} from "@/lib/participant-dashboard-ui";

export default async function ContactPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireActiveParticipantPage(session);

  return (
    <div className={participantDashboardPageClassName}>
      <div>
        <h1 className={participantDashboardPageTitleClassName}>Contact us</h1>
        <p className="text-[#17483F]">
          Get in touch with the study team.
        </p>
      </div>
      <ContactForm />
    </div>
  );
}
