import { AppBrandLogo } from "@/components/brand/app-brand-logo";
import { cn } from "@/lib/utils";

export function AuthBrandLogo({ className }: { className?: string }) {
  return (
    <AppBrandLogo
      size="hero"
      className={cn("mx-auto", className)}
      priority
    />
  );
}
