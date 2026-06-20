/** Groups ultrasound / MRI / blood booking steps under one checklist card. */
export const BOOK_APPOINTMENTS_GROUP_KEY = "book_appointments";

/** Level 3 long-term ultrasound / MRI booking group. */
export const BOOK_APPOINTMENTS_3Y_GROUP_KEY = "book_appointments_3y";

export type BookAppointmentRowConfig = {
  templateKey: string;
  label: string;
  externalUrl: string;
};

export const BOOK_APPOINTMENT_ROWS: BookAppointmentRowConfig[] = [
  {
    templateKey: "book_ultrasound",
    label: "Ultrasound",
    externalUrl: "https://specialistimaging.com.au/opening-times/",
  },
  {
    templateKey: "book_mri",
    label: "MRI",
    externalUrl: "https://example.com/book-mri",
  },
  {
    templateKey: "book_bloods",
    label: "Blood test",
    externalUrl: "https://example.com/book-bloods",
  },
];

export const BOOK_APPOINTMENT_3Y_ROWS: BookAppointmentRowConfig[] = [
  {
    templateKey: "book_ultrasound_3y",
    label: "Ultrasound",
    externalUrl: "https://specialistimaging.com.au/opening-times/",
  },
  {
    templateKey: "book_mri_3y",
    label: "MRI",
    externalUrl: "https://example.com/book-mri",
  },
];

export type BookingGroupDefinition = {
  rows: BookAppointmentRowConfig[];
  /** Template key used for group-level unlock evaluation. */
  unlockTemplateKey: string;
};

export const BOOKING_GROUP_DEFINITIONS: Record<string, BookingGroupDefinition> = {
  [BOOK_APPOINTMENTS_GROUP_KEY]: {
    rows: BOOK_APPOINTMENT_ROWS,
    unlockTemplateKey: "book_ultrasound",
  },
  [BOOK_APPOINTMENTS_3Y_GROUP_KEY]: {
    rows: BOOK_APPOINTMENT_3Y_ROWS,
    unlockTemplateKey: "book_ultrasound_3y",
  },
};

export function isKnownBookingGroupKey(
  completionGroupKey: string | null | undefined
): completionGroupKey is string {
  return (
    completionGroupKey != null &&
    completionGroupKey in BOOKING_GROUP_DEFINITIONS
  );
}

export function getBookingGroupDefinition(
  groupKey: string
): BookingGroupDefinition | undefined {
  return BOOKING_GROUP_DEFINITIONS[groupKey];
}

/** @deprecated Prefer isKnownBookingGroupKey for multi-group support. */
export function isBookAppointmentsGroupKey(
  completionGroupKey: string | null | undefined
): boolean {
  return completionGroupKey === BOOK_APPOINTMENTS_GROUP_KEY;
}
