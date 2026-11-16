import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

type IconComponent = ComponentType<{ className?: string; strokeWidth?: number }>;

const sizeClassNames = {
  sm: { circle: "h-7 w-7", icon: "h-4 w-4" },
  md: { circle: "h-11 w-11", icon: "h-5 w-5" },
  lg: { circle: "h-20 w-20", icon: "h-9 w-9" },
} as const;

/** Decorative line icon inside a tinted circle; the visible label carries the meaning. */
export function ParticipantIconBadge({
  icon: Icon,
  size = "md",
  className,
}: {
  icon: IconComponent;
  size?: keyof typeof sizeClassNames;
  className?: string;
}) {
  const classes = sizeClassNames[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-participant-tint/70 text-participant-primary-active ring-1 ring-participant-primary/10",
        classes.circle,
        className
      )}
      aria-hidden="true"
    >
      <Icon className={classes.icon} strokeWidth={1.5} />
    </span>
  );
}
