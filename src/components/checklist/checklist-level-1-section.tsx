import {
  getLevelDueLabel,
  LEVEL_1_SECTION_DUE_OFFSET_DAYS,
} from "@/components/checklist/level-1-enrollment-due-label";
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
  enrollmentDate: Date | null;
  enrollmentDateMissing: boolean;
  children: ReactNode;
};

export function ChecklistLevel1Section({
  completedCount,
  totalCount,
  enrollmentDate,
  enrollmentDateMissing,
  children,
}: Props) {
  const sectionDueLabel = getLevelDueLabel({
    enrollmentDate,
    dueOffsetDays: LEVEL_1_SECTION_DUE_OFFSET_DAYS,
    enrollmentDateMissing,
  });

  return (
    <section className={participantDashboardSectionClassName}>
      <div className="space-y-1 border-b border-[#2F8F7A]/20 pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className={cn("text-lg font-semibold", participantDashboardHeadingClassName)}>
            Level 1
          </h2>
          {sectionDueLabel ? (
            <span className="text-xs font-medium text-[#2F8F7A]">{sectionDueLabel}</span>
          ) : null}
        </div>
        <p className={cn("text-sm", participantDashboardMutedClassName)}>
          {completedCount} of {totalCount} complete
        </p>
      </div>

      <div className="space-y-3">{children}</div>
    </section>
  );
}
