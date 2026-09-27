import { ChevronDown } from "lucide-react";
import {
  participantDashboardHeadingClassName,
  participantDashboardMutedClassName,
  participantDashboardSectionClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type BaseProps = {
  title: string;
  /** Number of cards in the section. */
  count: number;
  children: ReactNode;
};

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <span
      className={cn(
        "text-lg font-semibold",
        participantDashboardHeadingClassName
      )}
    >
      {title}{" "}
      <span className={cn("font-normal", participantDashboardMutedClassName)}>
        ({count})
      </span>
    </span>
  );
}

export function ChecklistOpenSection({
  title,
  count,
  children,
  id,
}: BaseProps & { id: string }) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className={participantDashboardSectionClassName}
    >
      <h2 id={`${id}-heading`} className="border-b border-[#2F8F7A]/20 pb-3">
        <SectionHeading title={title} count={count} />
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** Collapsed by default. Native details/summary: no client JS, keyboard and screen-reader friendly. */
export function ChecklistCollapsibleSection({
  title,
  count,
  children,
  description,
}: BaseProps & { description?: string }) {
  return (
    <details className={cn("group", participantDashboardSectionClassName)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <h2 className="m-0">
          <SectionHeading title={title} count={count} />
        </h2>
        <ChevronDown
          aria-hidden
          className="h-5 w-5 shrink-0 text-[#2F8F7A] transition-transform group-open:rotate-180"
        />
      </summary>
      {description ? (
        <p className={cn("text-sm", participantDashboardMutedClassName)}>
          {description}
        </p>
      ) : null}
      <div className="space-y-3">{children}</div>
    </details>
  );
}

export function ChecklistShowMore({
  hiddenCount,
  children,
}: {
  hiddenCount: number;
  children: ReactNode;
}) {
  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-[#2F8F7A]/30 text-sm font-medium text-[#2F8F7A] [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Show {hiddenCount} more</span>
        <span className="hidden group-open:inline">Show fewer</span>
        <ChevronDown
          aria-hidden
          className="h-4 w-4 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}
