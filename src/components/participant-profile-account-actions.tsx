"use client";

import { signOut } from "next-auth/react";
import { KeyRound, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  participantDashboardBodyClassName,
  participantDashboardMutedClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";

export function ParticipantProfileAccountActions() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={cn("text-sm font-medium", participantDashboardBodyClassName)}>
            Change password
          </p>
          <p className={cn("text-sm", participantDashboardMutedClassName)}>
            Password changes will be available here soon.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled
          className="shrink-0 border-participant-primary/40 text-participant-primary-active"
          aria-disabled="true"
        >
          <KeyRound className="mr-2 h-4 w-4" />
          Change password
        </Button>
      </div>
      <div className="border-t border-participant-primary/15 pt-4">
        <Button
          type="button"
          variant="outline"
          className="border-participant-primary/40 text-participant-primary-active hover:bg-participant-surface"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
