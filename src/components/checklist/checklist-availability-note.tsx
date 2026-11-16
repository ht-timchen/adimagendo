import { Clock } from "lucide-react";

/** Timing note for a follow-up item that has not opened yet. */
export function ChecklistAvailabilityNote({ text }: { text: string }) {
  return (
    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-participant-muted">
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {text}
    </p>
  );
}
