import {
  getLevelDueLabel,
  LEVEL_3_SECTION_DUE_OFFSET_DAYS,
} from "@/components/checklist/level-1-enrollment-due-label";
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

export function ChecklistLevel3Section({
  unlocked,
  completedCount,
  totalCount,
  enrollmentDate,
  enrollmentDateMissing,
  children,
}: Props) {
  const sectionDueLabel = getLevelDueLabel({
    enrollmentDate,
    dueOffsetDays: LEVEL_3_SECTION_DUE_OFFSET_DAYS,
    enrollmentDateMissing,
  });

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/20">
      <div className="space-y-1 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {!unlocked ? (
              <Lock className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
            ) : null}
            Level 3
          </h2>
          {sectionDueLabel ? (
            <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
              {sectionDueLabel}
            </span>
          ) : null}
        </div>
        {unlocked ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {completedCount} of {totalCount} complete
          </p>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            🔒 Complete Level 2 to unlock
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
