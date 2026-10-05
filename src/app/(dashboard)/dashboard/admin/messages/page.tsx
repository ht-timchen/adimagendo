import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { MarkContactMessagesSeen } from "@/components/admin/mark-contact-messages-seen";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listContactMessages } from "@/lib/admin/contact-message-inbox";
import { formatAdelaideDateTime } from "@/lib/dates/adelaide-calendar";
import { requirePermissionOrRedirect } from "@/lib/people-admin-auth";

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ participant?: string | string[] }>;
}) {
  await requirePermissionOrRedirect("contact_message:read");
  const sp = await searchParams;
  const requested = typeof sp.participant === "string" ? sp.participant : undefined;

  // An unknown or malformed participant id is ignored and the whole inbox is shown.
  const { messages, participant } = await listContactMessages({ participantUserId: requested });
  const participantLabel = participant?.name?.trim() || participant?.email;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <MarkContactMessagesSeen />
      <div>
        <Link
          href="/dashboard/admin"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to overview
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Contact messages</h1>
        <p className="mt-1 text-sm text-slate-600">Messages sent by participants from the contact form.</p>
      </div>

      {participant ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm text-violet-900">
          <span>
            Showing messages from <span className="font-medium">{participantLabel}</span>
            {participant.name?.trim() ? <span className="text-violet-700"> · {participant.email}</span> : null}
          </span>
          <Link href="/dashboard/admin/messages" className="font-medium underline underline-offset-2 hover:text-violet-700">
            Show all
          </Link>
        </p>
      ) : null}

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-brand" />
            Inbox
          </CardTitle>
          <CardDescription>Open a message to read all of it. Click a name to see only that participant.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 pb-0">
          {messages.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500">
              {participant ? "No messages from this participant." : "No messages yet."}
            </p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Participant</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Preview</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg) => {
                  const u = msg.participant;
                  const href = `/dashboard/admin/messages/${encodeURIComponent(msg.id)}`;
                  return (
                    <tr key={msg.id} className="border-b border-slate-100 align-top hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/admin/messages?participant=${encodeURIComponent(u.id)}`}
                          className="font-medium text-slate-900 underline-offset-2 hover:text-brand hover:underline"
                        >
                          {u.name?.trim() || "—"}
                        </Link>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className="max-w-[200px] px-4 py-3">
                        <Link
                          href={href}
                          className="block truncate font-medium text-brand hover:text-brand-hover hover:underline"
                          title={msg.subject}
                        >
                          {msg.subject}
                        </Link>
                        {msg.category ? <p className="text-xs text-slate-500">{msg.category}</p> : null}
                      </td>
                      <td className="max-w-md px-4 py-3 text-slate-600">
                        {/* The subject is the keyboard stop; these clicks open the same message. */}
                        <Link href={href} tabIndex={-1} aria-hidden="true" className="block">
                          {msg.preview}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        <Link href={href} tabIndex={-1} aria-hidden="true" className="block">
                          {formatAdelaideDateTime(msg.createdAt)}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
