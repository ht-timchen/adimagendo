import type { SVGProps } from "react";

/** Person with a heart on the chest, drawn on lucide's 24px grid so it sits beside lucide icons. */
export function ProfileHeartIcon({
  strokeWidth = 1.5,
  ...props
}: SVGProps<SVGSVGElement> & { strokeWidth?: number | string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="12" cy="5" r="2.5" />
      <path d="M9.6 9h4.8a1.6 1.6 0 0 1 1.58 1.35L17 17.5H7l1.02-7.15A1.6 1.6 0 0 1 9.6 9Z" />
      <path d="M10 17.5V21" />
      <path d="M14 17.5V21" />
      <path
        d="M12 14.4 10.8 13.2a.85.85 0 1 1 1.2-1.2.85.85 0 1 1 1.2 1.2Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
