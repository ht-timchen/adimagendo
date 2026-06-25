import {
  participantDashboardBodyClassName,
  participantDashboardMutedClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
};

export function ParticipantProfileDetailRow({ label, value }: Props) {
  return (
    <div className="border-b border-[#2F8F7A]/15 py-3 first:pt-0 last:border-0 last:pb-0">
      <dt className={cn("text-sm", participantDashboardMutedClassName)}>{label}</dt>
      <dd className={cn("mt-0.5 text-sm font-medium", participantDashboardBodyClassName)}>
        {value}
      </dd>
    </div>
  );
}
