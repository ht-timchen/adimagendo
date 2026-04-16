/**
 * Build RFC 5545 iCalendar text for a study visit (no external deps).
 * Uses UTC (Z) for DTSTART/DTEND/DTSTAMP for broad client compatibility.
 */

export type StudyAppointmentIcsInput = {
  /** Stable per-appointment UID suffix (e.g. Prisma id) */
  appointmentId: string;
  startAt: Date;
  endAt: Date | null;
  /** Optional venue from scheduling */
  location?: string | null;
  /** Record title from the database */
  appointmentTitle: string;
  description?: string | null;
  /** R03 booking / reschedule link */
  externalUrl?: string | null;
};

function escapeIcsText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatUtcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Fold a single logical line to max 75 octets per RFC 5545 (CRLF + space continuation). */
function foldContentLine(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let rest = line;
  out.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    const chunkLen = Math.min(74, rest.length);
    out.push(` ${rest.slice(0, chunkLen)}`);
    rest = rest.slice(chunkLen);
  }
  return out.join("\r\n");
}

function defaultEnd(start: Date): Date {
  const d = new Date(start.getTime());
  d.setUTCHours(d.getUTCHours() + 1);
  return d;
}

const STUDY_SUMMARY = "ADIMAGENDO Study Appointment";

const DEFAULT_DESCRIPTION_INTRO =
  "This calendar entry is for your ADIMAGENDO study visit. Please arrive on time and bring anything your study team asked for. If you need to reschedule, use the study app or contact the team.";

export function generateStudyAppointmentIcs(input: StudyAppointmentIcsInput): string {
  const uid = `${input.appointmentId}@adimagendo-study.local`;
  const dtStamp = formatUtcStamp(new Date());
  const dtStart = formatUtcStamp(input.startAt);
  const end = input.endAt ?? defaultEnd(input.startAt);
  const dtEnd = formatUtcStamp(end);

  const descParts: string[] = [DEFAULT_DESCRIPTION_INTRO];
  if (input.appointmentTitle.trim()) {
    descParts.push("");
    descParts.push(`Appointment: ${input.appointmentTitle.trim()}`);
  }
  if (input.description?.trim()) {
    descParts.push("");
    descParts.push(input.description.trim());
  }
  if (input.externalUrl?.trim()) {
    descParts.push("");
    descParts.push(`Booking / details: ${input.externalUrl.trim()}`);
  }
  const description = escapeIcsText(descParts.join("\n"));
  const summary = escapeIcsText(input.appointmentTitle.trim() || STUDY_SUMMARY);
  const location = input.location?.trim()
    ? escapeIcsText(input.location.trim())
    : "";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ADIMAGENDO//Participant App//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    foldContentLine(`UID:${uid}`),
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    foldContentLine(`SUMMARY:${summary}`),
    foldContentLine(`DESCRIPTION:${description}`),
  ];

  if (location) {
    lines.push(foldContentLine(`LOCATION:${location}`));
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n") + "\r\n";
}

export function studyAppointmentIcsFilename(appointmentId: string): string {
  const safe = appointmentId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "visit";
  return `adimagendo-appointment-${safe}.ics`;
}
