/**
 * What the Enrolment Links page shows for one REDCap participant: a status and the next
 * action. Derived on the server (from the account and all of the record's tokens), so the
 * result does not depend on how many tokens the page happens to list.
 */
export type EnrolmentRowState =
  | { kind: "no-link" }
  | { kind: "link-active"; expiresAt: string }
  | { kind: "link-expired" }
  | { kind: "link-revoked" }
  | { kind: "link-used" } // the link was used but no account is linked any more
  | { kind: "registered" }
  | { kind: "deactivated" };

export type RowStateToken = {
  usedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
};

export function deriveEnrolmentRowState(input: {
  /** The account linked to this study record, or null when nobody has registered. */
  account: { isActive: boolean } | null;
  /** Every token ever issued for this study record. */
  tokens: readonly RowStateToken[];
  now: Date;
}): EnrolmentRowState {
  const { account, tokens, now } = input;
  if (account) return account.isActive ? { kind: "registered" } : { kind: "deactivated" };

  const active = tokens
    .filter((t) => !t.usedAt && !t.revokedAt && t.expiresAt > now)
    .sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime())[0];
  if (active) return { kind: "link-active", expiresAt: active.expiresAt.toISOString() };
  if (tokens.some((t) => t.usedAt)) return { kind: "link-used" };
  if (tokens.some((t) => t.revokedAt)) return { kind: "link-revoked" };
  if (tokens.length > 0) return { kind: "link-expired" };
  return { kind: "no-link" };
}

export type RowStatusTone = "none" | "success" | "accent" | "danger" | "muted";

export function rowStatusPresentation(state: EnrolmentRowState): { label: string; tone: RowStatusTone } {
  switch (state.kind) {
    case "no-link":
      return { label: "No enrolment link", tone: "none" };
    case "link-active":
      return { label: "Enrolment link active", tone: "success" };
    case "link-expired":
      return { label: "Enrolment link expired", tone: "muted" };
    case "link-revoked":
      return { label: "Enrolment link revoked", tone: "muted" };
    case "link-used":
      return { label: "Enrolment link used", tone: "accent" };
    case "registered":
      return { label: "Registered", tone: "accent" };
    case "deactivated":
      return { label: "Account deactivated", tone: "danger" };
  }
}

/** "generate" = make a link, "copy" = copy the current link, "view" = open the participant. */
export type RowPrimaryAction = "generate" | "copy" | "view";

export function rowPrimaryAction(state: EnrolmentRowState): RowPrimaryAction {
  switch (state.kind) {
    case "link-active":
      return "copy";
    case "registered":
    case "deactivated":
      return "view";
    default:
      return "generate";
  }
}

export function replaceLinkConfirmation(name: string | null, studyRecordId: string): string {
  const who = name ? `${name} (Record ${studyRecordId})` : `Record ${studyRecordId}`;
  return `Generate a new enrolment link for ${who}? The current link will stop working.`;
}
