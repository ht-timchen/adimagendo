import {
  getLevelDueLabel,
  LEVEL_1_SECTION_DUE_OFFSET_DAYS,
} from "@/components/checklist/level-1-enrollment-due-label";
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
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/20">
      <div className="space-y-1 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Level 1
          </h2>
          {sectionDueLabel ? (
            <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
              {sectionDueLabel}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {completedCount} of {totalCount} complete
        </p>
      </div>

      <div className="space-y-3">{children}</div>
    </section>
  );
}
