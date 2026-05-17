/** Groups ultrasound / MRI / blood booking steps under one checklist card. */
export const BOOK_APPOINTMENTS_GROUP_KEY = "book_appointments";

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

export function isBookAppointmentsGroupKey(
  completionGroupKey: string | null | undefined
): boolean {
  return completionGroupKey === BOOK_APPOINTMENTS_GROUP_KEY;
}
