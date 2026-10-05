import { redirect } from "next/navigation";

/**
 * Surveys moved into Checklist: completing a SURVEY-type checklist step (Checklist's own
 * "Complete survey" button) is now the only way to complete a survey in the app. This page is
 * kept only as a redirect for old links/bookmarks pointing at the retired survey-taking form —
 * there is no per-id checklist equivalent to deep-link into, so every id redirects to Checklist.
 */
export default function SurveyTakePage() {
  redirect("/dashboard/checklist");
}
