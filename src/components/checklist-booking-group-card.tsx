import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChecklistLockReasons } from "@/components/checklist-lock-reasons";
import {
  ChecklistExternalBookingFlow,
  type ChecklistBookingProgress,
} from "@/components/checklist-external-booking-flow";
import type { BookAppointmentRowConfig } from "@/lib/checklist-booking-group";
import type { ChecklistStatus } from "@prisma/client";
import {
  participantDashboardCardClassName,
  participantDashboardHeadingClassName,
  participantDashboardMutedClassName,
  participantDashboardSurfaceClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";

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
  dueLabel?: string | null;
};

export function ChecklistBookingGroupCard({
  title,
  description,
  rows,
  isLocked,
  lockReasons,
  dueLabel,
}: Props) {
  return (
    <Card className={participantDashboardCardClassName}>
      <CardHeader className="flex flex-row items-start gap-4 pb-2">
        <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#2F8F7A]/30" />
        <div className="min-w-0 flex-1">
          <CardTitle className={cn("text-base", participantDashboardHeadingClassName)}>
            {title}
          </CardTitle>
          <p className={cn("mt-1 text-sm", participantDashboardMutedClassName)}>
            {description}
          </p>
          {dueLabel ? (
            <p className="mt-1 text-xs text-[#2F8F7A]">{dueLabel}</p>
          ) : null}
          <p className={cn("mt-2 text-xs", participantDashboardMutedClassName)}>
            Appointments can be booked in any order.
          </p>
          {isLocked ? <ChecklistLockReasons reasons={lockReasons} /> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {rows.map((row) => (
          <div
            key={row.config.templateKey}
            className={cn("rounded-md p-3", participantDashboardSurfaceClassName)}
          >
            <p className={cn("text-sm font-medium", participantDashboardHeadingClassName)}>
              {row.config.label}
            </p>
            <ChecklistExternalBookingFlow
              templateId={row.templateId}
              checklistItemId={row.checklistItemId}
              templateTitle={row.templateTitle}
              templateDescription={row.templateDescription}
              externalUrl={row.config.externalUrl}
              bookingProgress={row.bookingProgress}
              appointment={row.appointment}
              actionsDisabled={isLocked}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
