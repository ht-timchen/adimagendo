import { cn } from "@/lib/utils";

const PARTICIPANT_LOGO_SRC = "/images/adimagendo-mascot-white-bg.png";

type ParticipantBrandLogoProps = {
  className?: string;
  sizeClassName?: string;
  imageClassName?: string;
  imageSrc?: string;
  priority?: boolean;
};

/** Participant-facing logo (icon only). Uses a plain img for reliable static serving. */
export function ParticipantBrandLogo({
  className,
  sizeClassName = "h-32 w-32 sm:h-36 sm:w-36",
  imageClassName,
  imageSrc = PARTICIPANT_LOGO_SRC,
  priority,
}: ParticipantBrandLogoProps) {
  return (
    <div
      className={cn(
        "mx-auto flex items-center justify-center overflow-visible border-0 bg-transparent shadow-none",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt="ADIMAGENDO"
        width={144}
        height={144}
        className={cn(sizeClassName, "object-contain", imageClassName)}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    </div>
  );
}
