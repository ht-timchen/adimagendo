/** Primary CTA styling for participant auth flows (matches logo green). */
export const participantPrimaryButtonClassName =
  "bg-[#2F8F7A] text-white hover:bg-[#277866] active:bg-[#216657] focus-visible:ring-[#2F8F7A]/50";

/** Standalone link/button elements on participant auth pages. */
export const participantPrimaryLinkClassName =
  "inline-flex items-center justify-center rounded-lg bg-[#2F8F7A] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#277866] active:bg-[#216657] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F8F7A]/50 focus-visible:ring-offset-2";

/** @deprecated Use participantPrimaryButtonClassName on participant pages only. */
export const authPrimaryButtonClassName = participantPrimaryButtonClassName;

/** @deprecated Use participantPrimaryLinkClassName on participant pages only. */
export const authPrimaryLinkClassName = participantPrimaryLinkClassName;

/** Admin/staff sign-in when callback targets the admin dashboard. */
export function isStaffAuthLogin(callbackUrl: string | null | undefined): boolean {
  if (!callbackUrl?.trim()) return false;
  const value = callbackUrl.trim();
  try {
    const path = value.startsWith("http") ? new URL(value).pathname : value.split("?")[0] ?? value;
    return path === "/dashboard/admin" || path.startsWith("/dashboard/admin/");
  } catch {
    return value.includes("/dashboard/admin");
  }
}
