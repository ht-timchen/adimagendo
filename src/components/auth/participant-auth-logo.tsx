import { ParticipantBrandLogo } from "@/components/auth/participant-brand-logo";

export function ParticipantAuthLogo({
  className,
}: {
  className?: string;
}) {
  return <ParticipantBrandLogo className={className} priority />;
}
