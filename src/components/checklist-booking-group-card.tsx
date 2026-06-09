import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChecklistLockReasons } from "@/components/checklist-lock-reasons";
import {
  ChecklistExternalBookingFlow,
  type ChecklistBookingProgress,
} from "@/components/checklist-external-booking-flow";
import {
  BOOK_APPOINTMENT_ROWS,
  type BookAppointmentRowConfig,
} from "@/lib/checklist-booking-group";
import type { ChecklistStatus } from "@prisma/client";

type AppointmentPayload = {
  id: string;
  title: string;
  description: string | null;
  scheduledStartAt: string | null;
  scheduledLocation: string | null;
  location: string | null;
  startAt: string;
  externalUrl: string | null;
};

export type BookingGroupRowState = {
  config: BookAppointmentRowConfig;
  templateId: string;
  checklistItemId: string | null;
  templateTitle: string;
  templateDescription: string | null;
  status: ChecklistStatus;
  bookingProgress: ChecklistBookingProgress;
  appointment: AppointmentPayload | null;
};

type Props = {
  title: string;
  description: string;
  rows: BookingGroupRowState[];
  isLocked: boolean;
  lockReasons: string[];
};

export function ChecklistBookingGroupCard({
  title,
  description,
  rows,
  isLocked,
  lockReasons,
}: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4 pb-2">
        <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600" />
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {description}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Appointments can be booked in any order.
          </p>
          {isLocked ? <ChecklistLockReasons reasons={lockReasons} /> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {BOOK_APPOINTMENT_ROWS.map((config) => {
          const row = rows.find((r) => r.config.templateKey === config.templateKey);
          if (!row) return null;

          return (
            <div
              key={config.templateKey}
              className="rounded-md border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {config.label}
              </p>
              <ChecklistExternalBookingFlow
                templateId={row.templateId}
                checklistItemId={row.checklistItemId}
                templateTitle={row.templateTitle}
                templateDescription={row.templateDescription}
                externalUrl={config.externalUrl}
                bookingProgress={row.bookingProgress}
                appointment={row.appointment}
                actionsDisabled={isLocked}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
