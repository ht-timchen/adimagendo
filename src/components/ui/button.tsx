import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-button-fill text-white hover:bg-button-fill-hover active:bg-button-fill-active focus-visible:ring-brand/50",
        participant:
          "bg-[#2F8F7A] text-white hover:bg-[#277866] active:bg-[#216657] focus-visible:ring-[#2F8F7A]/50",
        brand:
          "bg-brand text-white hover:bg-brand-hover active:bg-brand-active focus-visible:ring-brand/50 auth-primary-button",
        secondary:
          "bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
        outline:
          "border border-slate-200 bg-white hover:bg-slate-50 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800",
        ghost: "hover:bg-slate-100 focus-visible:ring-slate-400 dark:hover:bg-slate-800",
        link: "text-brand underline-offset-4 hover:text-brand-hover hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Disabled because a prerequisite is not met (not while saving); adds a lock in the participant shell. */
  locked?: boolean;
}

/** The label comes first, so the lock does not sit next to an existing leading icon. */
function startsWithText(children: React.ReactNode): boolean {
  const first = React.Children.toArray(children)[0];
  return typeof first === "string" || typeof first === "number";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, locked = false, children, ...props }, ref) => {
    const showLock =
      locked &&
      (props.disabled || props["aria-disabled"] === true || props["aria-disabled"] === "true") &&
      startsWithText(children);
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      >
        {showLock ? (
          <Lock className="button-disabled-lock" strokeWidth={1.5} aria-hidden="true" />
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
