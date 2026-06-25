import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/images/adimagendo-mascot-white-bg.png";

const SIZES = {
  /** Participant / mobile admin top bar */
  header: { width: 64, height: 64, className: "h-16 w-16" },
  /** Admin desktop sidebar */
  sidebar: { width: 80, height: 80, className: "h-20 w-20" },
  hero: { width: 144, height: 144, className: "h-32 w-32 sm:h-36 sm:w-36" },
} as const;

type AppBrandLogoProps = {
  size?: keyof typeof SIZES;
  href?: string;
  className?: string;
  priority?: boolean;
};

export function AppBrandLogo({
  size = "hero",
  href,
  className,
  priority,
}: AppBrandLogoProps) {
  const dimensions = SIZES[size];
  const image = (
    <Image
      src={LOGO_SRC}
      alt="ADIMAGENDO"
      width={dimensions.width}
      height={dimensions.height}
      className={cn(dimensions.className, "object-contain object-center", className)}
      priority={priority ?? size !== "hero"}
      unoptimized
    />
  );

  const content = (
    <span className="inline-flex shrink-0 items-center justify-center leading-none">
      {image}
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex focus-visible:outline-none"
        aria-label="ADIMAGENDO home"
      >
        {content}
      </Link>
    );
  }

  return content;
}
