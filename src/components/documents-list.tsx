"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { participantDashboardCardClassName, participantDashboardHeadingClassName, participantDashboardMutedClassName } from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";

type Document = {
  id: string;
  title: string;
  type: string;
  isReferral: boolean;
  createdAt: string;
};

export function DocumentsList({ refreshKey = 0 }: { refreshKey?: number }) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- request lifecycle sync: enter loading state before each fetch (including refreshKey refresh) to avoid stale content flash
    setLoading(true);
    fetch("/api/documents", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setDocs(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const referrals = docs.filter((d) => d.isReferral);
  const reportCards = docs.filter((d) => !d.isReferral && d.type === "REPORT_CARD");

  return (
    <div className="space-y-6">
      <Card className={participantDashboardCardClassName}>
        <CardHeader>
          <CardTitle className={cn("text-base", participantDashboardHeadingClassName)}>Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className={cn("text-sm", participantDashboardMutedClassName)}>Loading…</p>
          ) : referrals.length === 0 ? (
            <p className={cn("text-sm", participantDashboardMutedClassName)}>
              No referrals yet. The study team can send referrals to you here.
            </p>
          ) : (
            <ul className="space-y-2">
              {referrals.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-[#2F8F7A]/20 bg-white/85 px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    {d.title}
                  </span>
                  <a href={`/api/documents/${d.id}/download`} download>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className={participantDashboardCardClassName}>
        <CardHeader>
          <CardTitle className={cn("text-base", participantDashboardHeadingClassName)}>Your uploads (report cards)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className={cn("text-sm", participantDashboardMutedClassName)}>Loading…</p>
          ) : reportCards.length === 0 ? (
            <p className={cn("text-sm", participantDashboardMutedClassName)}>No report cards uploaded yet.</p>
          ) : (
            <ul className="space-y-2">
              {reportCards.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-[#2F8F7A]/20 bg-white/85 px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    {d.title}
                  </span>
                  <a href={`/api/documents/${d.id}/download`} download>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
