import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAdelaideDateTime } from "@/lib/dates/adelaide-calendar";
import { getContactMessageDetail } from "@/lib/admin/contact-message-inbox";
import { requirePermissionOrRedirect } from "@/lib/people-admin-auth";

export default async function AdminContactMessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermissionOrRedirect("contact_message:read");
  const { id } = await params;

  const detail = await getContactMessageDetail(id);
  if (!detail) notFound();
  const { message, otherMessages } = detail;
  const participantLabel = message.participant.name?.trim() || message.participant.email;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/dashboard/admin/messages"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to inbox
      </Link>

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-start gap-2 text-xl">
            <Mail className="mt-1 h-5 w-5 shrink-0 text-brand" />
            <span className="min-w-0 break-words">{message.subject}</span>
          </CardTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500">From</dt>
            <dd className="min-w-0 break-words text-slate-900">
              <span className="font-medium">{message.participant.name?.trim() || "—"}</span>
              <span className="text-slate-500"> · {message.participant.email}</span>
            </dd>
            <dt className="text-slate-500">Sent</dt>
            <dd className="text-slate-900">{formatAdelaideDateTime(message.createdAt)}</dd>
            {message.category ? (
              <>
                <dt className="text-slate-500">Category</dt>
                <dd className="text-slate-900">{message.category}</dd>
              </>
            ) : null}
          </dl>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {message.participant.studyRecordId ? (
              <Link
                href={`/dashboard/admin/participants/${encodeURIComponent(message.participant.studyRecordId)}`}
                className="text-brand hover:text-brand-hover hover:underline"
              >
                View participant record
              </Link>
            ) : null}
            <Link
              href={`/dashboard/admin/messages?participant=${encodeURIComponent(message.participant.id)}`}
              className="text-brand hover:text-brand-hover hover:underline"
            >
              All messages from {participantLabel}
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {/* Plain text only: line breaks kept, never interpreted as HTML or markdown. */}
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
            {message.body}
          </p>
        </CardContent>
      </Card>

      {otherMessages.length > 0 ? (
        <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
          <details>
            <summary className="cursor-pointer list-none px-6 py-4 text-base font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
              Other messages from this participant ({otherMessages.length})
            </summary>
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {otherMessages.map((other) => (
                <li key={other.id}>
                  <Link
                    href={`/dashboard/admin/messages/${encodeURIComponent(other.id)}`}
                    className="block px-6 py-3 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="min-w-0 break-words font-medium text-slate-900">{other.subject}</span>
                      <span className="shrink-0 text-xs text-slate-500">{formatAdelaideDateTime(other.createdAt)}</span>
                    </div>
                    {other.category ? <p className="text-xs text-slate-500">{other.category}</p> : null}
                    <p className="mt-1 break-words text-sm text-slate-600">{other.preview}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      ) : null}
    </div>
  );
}
