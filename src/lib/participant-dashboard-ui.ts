/** Shared light translucent surfaces for participant dashboard / mobile PWA. */

export const participantDashboardSectionClassName =
  "space-y-3 rounded-2xl border border-participant-primary/15 bg-participant-card backdrop-blur-md shadow-(--participant-shadow) p-4";

export const participantDashboardSurfaceClassName =
  "border border-participant-primary/15 bg-participant-card backdrop-blur-md shadow-(--participant-shadow)";

/** @alias participantDashboardSurfaceClassName */
export const participantDashboardCardClassName = participantDashboardSurfaceClassName;

export const participantDashboardModalClassName =
  "rounded-lg border border-participant-primary/20 bg-participant-card backdrop-blur-md shadow-xl";

export const participantDashboardInputClassName =
  "border border-participant-primary/20 bg-participant-card backdrop-blur-md text-participant-ink placeholder:text-participant-muted focus-visible:ring-participant-primary/40";

/** Keyboard focus ring; full-strength primary keeps it above 3:1 on every participant background. */
export const participantFocusRingClassName =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-participant-primary focus-visible:ring-offset-2 focus-visible:ring-offset-participant-page";

/** Search landing target on the checklist; ChecklistHashTarget sets data-search-target briefly. */
export const participantChecklistAnchorClassName =
  "scroll-mt-24 rounded-xl outline-none transition-shadow data-[search-target]:ring-2 data-[search-target]:ring-participant-primary data-[search-target]:ring-offset-2 data-[search-target]:ring-offset-participant-page";

/** Whole-card link on the participant home page. */
export const participantDashboardLinkCardClassName =
  "rounded-2xl border border-participant-primary/15 bg-participant-card shadow-(--participant-shadow) backdrop-blur-md transition-colors hover:bg-participant-surface";

export const participantDashboardHeadingClassName = "text-participant-heading";
export const participantDashboardBodyClassName = "text-participant-ink";
export const participantDashboardMutedClassName = "text-participant-muted";
export const participantDashboardLabelClassName =
  "text-sm font-medium text-participant-ink";

/** Standard participant page shell (matches checklist layout). */
export const participantDashboardPageClassName =
  "mx-auto max-w-2xl space-y-6 text-participant-ink";

export const participantDashboardPageTitleClassName =
  "text-2xl font-bold text-participant-heading";

export const participantDashboardCalendarMutedClassName =
  "font-medium text-participant-muted";

export const participantDashboardCalendarDayClassName =
  "rounded-lg border border-participant-primary/15 p-2 text-sm text-participant-ink transition-colors";

export const participantDashboardCalendarDayOutsideClassName =
  "text-participant-muted/45";

export const participantDashboardCalendarDaySelectedClassName =
  "bg-participant-primary/15 ring-2 ring-participant-primary/50";

export const participantDashboardCalendarDayHasEntryClassName =
  "bg-participant-primary/20";
