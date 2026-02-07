import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default async function AdminMessagesPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;

  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true, name: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/admin"
          className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" /> Back to overview
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Contact messages
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Messages sent by participants via the contact form.
        </p>
      </div>

      <div className="space-y-3">
        {messages.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-slate-600 dark:text-slate-400">
              No messages yet.
            </CardContent>
          </Card>
        ) : (
          messages.map((msg) => (
            <Card key={msg.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{msg.subject}</CardTitle>
                  <span className="text-xs text-slate-500">
                    {msg.createdAt.toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  From: {msg.user.name ?? msg.user.email}
                  {msg.user.name && ` (${msg.user.email})`}
                  {msg.category && ` · ${msg.category}`}
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="whitespace-pre-wrap text-sm">{msg.message}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
