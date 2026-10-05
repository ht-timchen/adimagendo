import { redirect } from "next/navigation";

/**
 * Surveys moved into Checklist: completing a SURVEY-type checklist step (Checklist's own
 * "Complete survey" button) is now the only way to complete a survey in the app. This page is
 * kept only as a redirect for old links/bookmarks pointing at the retired standalone list.
 */
export default function SurveysPage() {
  redirect("/dashboard/checklist");
}
