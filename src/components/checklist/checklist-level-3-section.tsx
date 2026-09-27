import {
  participantDashboardHeadingClassName,
  participantDashboardMutedClassName,
  participantDashboardSectionClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  completedCount: number;
  totalCount: number;
  children: ReactNode;
};

/** Level 3 grouping. Items open by their own calendar timing, not by Level 2 completion. */
export function ChecklistLevel3Section({
  completedCount,
  totalCount,
  children,
}: Props) {
  return (
    <section className={participantDashboardSectionClassName}>
      <div className="space-y-1 border-b border-[#2F8F7A]/20 pb-3">
        <h2
          className={cn(
            "flex items-center gap-2 text-lg font-semibold",
            participantDashboardHeadingClassName
          )}
        >
          Level 3
        </h2>
        <p className={cn("text-sm", participantDashboardMutedClassName)}>
          {completedCount} of {totalCount} complete
        </p>
      </div>

      <div className="space-y-3">{children}</div>
    </section>
  );
}
