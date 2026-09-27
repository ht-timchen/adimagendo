import Link from "next/link";
import { CircleAlert, Clock, Hourglass } from "lucide-react";
import {
  SURVEY_WINDOW_CLOSED_CONTACT_LINK_TEXT,
  SURVEY_WINDOW_CLOSED_CONTACT_PREFIX,
  SURVEY_WINDOW_DAYS_LEFT_THRESHOLD,
  type SurveyWindow,
} from "@/lib/checklist/follow-up-availability";
import { cn } from "@/lib/utils";

/** Survey window line on follow-up survey cards. Display only. */
export function ChecklistSurveyWindowNote({
  surveyWindow,
  testLabel,
}: {
  surveyWindow: SurveyWindow;
  testLabel: string | null;
}) {
  const endingSoon =
    surveyWindow.state === "last_day" ||
    (surveyWindow.state === "open" &&
      surveyWindow.daysLeft != null &&
      surveyWindow.daysLeft <= SURVEY_WINDOW_DAYS_LEFT_THRESHOLD);
  const Icon =
    surveyWindow.state === "closed" ? CircleAlert : endingSoon ? Hourglass : Clock;

  return (
    <div className="mt-1 space-y-0.5">
      <p
        className={cn(
          "flex items-start gap-1.5 text-xs font-medium",
          surveyWindow.state === "closed" || endingSoon
            ? "text-amber-800"
            : "text-[#2A6F60]"
        )}
      >
        <Icon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          {surveyWindow.text}
          {surveyWindow.state === "closed" ? (
            <>
              {" "}
              {SURVEY_WINDOW_CLOSED_CONTACT_PREFIX}{" "}
              <Link href="/dashboard/contact" className="underline underline-offset-2">
                {SURVEY_WINDOW_CLOSED_CONTACT_LINK_TEXT}
              </Link>
              .
            </>
          ) : null}
        </span>
      </p>
      {testLabel && surveyWindow.state !== "closed" ? (
        <p className="pl-5 text-[11px] text-slate-500">{testLabel}</p>
      ) : null}
    </div>
  );
}
