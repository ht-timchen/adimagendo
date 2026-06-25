import {
  getLevelDueLabel,
  LEVEL_2_SECTION_DUE_OFFSET_DAYS,
} from "@/components/checklist/level-1-enrollment-due-label";
import {
  participantDashboardHeadingClassName,
  participantDashboardMutedClassName,
  participantDashboardSectionClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  unlocked: boolean;
  completedCount: number;
  totalCount: number;
  enrollmentDate: Date | null;
  enrollmentDateMissing: boolean;
  children: ReactNode;
};

export function ChecklistLevel2Section({
  unlocked,
  completedCount,
  totalCount,
  enrollmentDate,
  enrollmentDateMissing,
  children,
}: Props) {
  const sectionDueLabel = getLevelDueLabel({
    enrollmentDate,
    dueOffsetDays: LEVEL_2_SECTION_DUE_OFFSET_DAYS,
    enrollmentDateMissing,
  });

  return (
    <section className={participantDashboardSectionClassName}>
      <div className="space-y-1 border-b border-[#2F8F7A]/20 pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2
            className={cn(
              "flex items-center gap-2 text-lg font-semibold",
              participantDashboardHeadingClassName
            )}
          >
            {!unlocked ? (
              <Lock className="h-4 w-4 shrink-0 text-[#1F5C50]" />
            ) : null}
            Level 2
          </h2>
          {sectionDueLabel ? (
            <span className="text-xs font-medium text-[#2F8F7A]">{sectionDueLabel}</span>
          ) : null}
        </div>
        {unlocked ? (
          <p className={cn("text-sm", participantDashboardMutedClassName)}>
            {completedCount} of {totalCount} complete
          </p>
        ) : (
          <p className={cn("text-sm", participantDashboardMutedClassName)}>
            🔒 Complete Level 1 to unlock
          </p>
        )}
      </div>

      <div
        className={
          unlocked
            ? "space-y-3"
            : "pointer-events-none space-y-3 opacity-50"
        }
      >
        {children}
      </div>
    </section>
  );
}
