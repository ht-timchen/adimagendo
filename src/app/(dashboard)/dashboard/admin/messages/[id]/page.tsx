import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import {
  ContactReplyButton,
  ContactReplyComposer,
  ContactReplyProvider,
} from "@/components/admin/contact-reply-composer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { participantFirstName } from "@/lib/admin/contact-message-reply";
import { hasPermission } from "@/lib/admin-rbac";
import { formatAdelaideDateTime } from "@/lib/dates/adelaide-calendar";
import { contactReplyReadLabel, getContactMessageDetail } from "@/lib/admin/contact-message-inbox";
import { requirePermissionOrRedirect } from "@/lib/people-admin-auth";

export default async function AdminContactMessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermissionOrRedirect("contact_message:read");
  const canReply = hasPermission(session, "contact_message:reply");
  const { id } = await params;

  const detail = await getContactMessageDetail(id);
  if (!detail) notFound();
  const { message, otherMessages, replies, participantActive } = detail;
  const participantLabel = message.participant.name?.trim() || message.participant.email;

  const messageCard = (
    <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="flex min-w-0 items-start gap-2 text-xl">
            <Mail className="mt-1 h-5 w-5 shrink-0 text-brand" />
            <span className="min-w-0 break-words">{message.subject}</span>
          </CardTitle>
          {canReply ? <ContactReplyButton /> : null}
        </div>
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
      {canReply ? (
        <CardContent className="border-t border-slate-100 pt-4">
          <ContactReplyComposer />
        </CardContent>
      ) : null}
    </Card>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/dashboard/admin/messages"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to inbox
      </Link>

      {canReply ? (
        <ContactReplyProvider
          contactMessageId={message.id}
          participant={{
            name: message.participant.name,
            firstName: participantFirstName(message.participant.name),
            email: message.participant.email,
            studyRecordId: message.participant.studyRecordId,
          }}
          hasReplies={replies.length > 0}
          participantActive={participantActive}
        >
          {messageCard}
        </ContactReplyProvider>
      ) : (
        messageCard
      )}

      {replies.length > 0 ? (
        <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
          <CardHeader>
            <CardTitle className="text-base">Replies ({replies.length})</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {replies.map((reply) => (
                <li key={reply.id} className="space-y-2 px-6 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>
                      <span className="font-medium text-slate-700">{reply.adminName}</span>
                      {" · "}
                      {formatAdelaideDateTime(reply.createdAt)}
                    </span>
                    <span
                      className={
                        reply.read
                          ? "rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800"
                          : "rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700"
                      }
                    >
                      {contactReplyReadLabel(reply.read)}
                    </span>
                  </div>
                  <p className="break-words font-medium text-slate-900">{reply.title}</p>
                  {/* Plain text only, like the participant's message. */}
                  {reply.body ? (
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
                      {reply.body}
                    </p>
                  ) : null}
                  <p className="text-xs text-slate-500">Sent to {participantLabel} only</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

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
