import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail } from "lucide-react";

function preview(text: string, max = 120) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export default async function AdminMessagesPage() {
  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true, name: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
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

      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-violet-600" />
            Inbox
          </CardTitle>
          <CardDescription>Participant, preview, and received time.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 pb-0">
          {messages.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500">No messages yet.</p>
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
                  const u = msg.user;
                  return (
                    <tr key={msg.id} className="border-b border-slate-100 align-top hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{u.name?.trim() || "—"}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className="max-w-[200px] px-4 py-3">
                        <p className="truncate font-medium text-slate-800" title={msg.subject}>
                          {msg.subject}
                        </p>
                        {msg.category ? (
                          <p className="text-xs text-slate-500">{msg.category}</p>
                        ) : null}
                      </td>
                      <td className="max-w-md px-4 py-3 text-slate-600">
                        <p title={msg.message}>{preview(msg.message)}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {msg.createdAt.toLocaleString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
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
