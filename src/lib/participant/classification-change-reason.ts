import { z } from "zod";

export const CLASSIFICATION_REASON_TEXT_MAX = 200;

export const CLASSIFICATION_REASON_LABELS = {
  RECORD_IS_TEST: "Record is a test record",
  TESTING_TIMING: "Testing timing scenario",
  CORRECTING_TEST_DATA: "Correcting test data",
  MARKED_TEST_BY_MISTAKE: "Marked as test by mistake",
  CONFIRMED_PILOT: "Confirmed pilot participant",
  OTHER: "Other",
} as const;

export type ClassificationReasonCode = keyof typeof CLASSIFICATION_REASON_LABELS;

export type ClassificationChangeAction =
  | "mark_test"
  | "unmark_test"
  | "mark_pilot"
  | "edit_test_enrollment_date";

export const CLASSIFICATION_REASON_OPTIONS: Record<
  ClassificationChangeAction,
  readonly ClassificationReasonCode[]
> = {
  mark_test: ["RECORD_IS_TEST", "CORRECTING_TEST_DATA", "OTHER"],
  unmark_test: ["MARKED_TEST_BY_MISTAKE", "CORRECTING_TEST_DATA", "OTHER"],
  mark_pilot: ["CONFIRMED_PILOT", "OTHER"],
  edit_test_enrollment_date: ["TESTING_TIMING", "CORRECTING_TEST_DATA", "OTHER"],
};

export type ClassificationChangeReason = {
  code: ClassificationReasonCode;
  label: string;
  text: string | null;
};

export type ClassificationChangeReasonInput = {
  reasonCode?: unknown;
  reasonText?: unknown;
};

const ReasonSchema = z.object({
  reasonCode: z.string({ error: "Reason is required" }).trim().min(1, "Reason is required"),
  reasonText: z
    .string()
    .trim()
    .max(
      CLASSIFICATION_REASON_TEXT_MAX,
      `Reason details must be ${CLASSIFICATION_REASON_TEXT_MAX} characters or fewer`
    )
    .nullish(),
});

export type ParseClassificationReasonResult =
  | { ok: true; reason: ClassificationChangeReason }
  | { ok: false; error: string };

/** Preset is required; free text is required only for "Other". */
export function parseClassificationChangeReason(
  action: ClassificationChangeAction,
  input: ClassificationChangeReasonInput | null | undefined
): ParseClassificationReasonResult {
  const parsed = ReasonSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid reason",
    };
  }
  const code = parsed.data.reasonCode as ClassificationReasonCode;
  if (!CLASSIFICATION_REASON_OPTIONS[action].includes(code)) {
    return { ok: false, error: "Choose a reason from the list" };
  }
  const text = parsed.data.reasonText?.trim() || null;
  if (code === "OTHER" && !text) {
    return { ok: false, error: "Please describe the reason" };
  }
  return {
    ok: true,
    reason: { code, label: CLASSIFICATION_REASON_LABELS[code], text },
  };
}
