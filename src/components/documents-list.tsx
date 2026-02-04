"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";

type Document = {
  id: string;
  title: string;
  type: string;
  isReferral: boolean;
  createdAt: string;
};

export function DocumentsList() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/documents")
      .then((res) => res.ok ? res.json() : [])
      .then(setDocs)
      .finally(() => setLoading(false));
  }, []);

  const referrals = docs.filter((d) => d.isReferral);
  const reportCards = docs.filter((d) => !d.isReferral && d.type === "REPORT_CARD");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : referrals.length === 0 ? (
            <p className="text-sm text-slate-500">
              No referrals yet. The study team can send referrals to you here.
            </p>
          ) : (
            <ul className="space-y-2">
              {referrals.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your uploads (report cards)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : reportCards.length === 0 ? (
            <p className="text-sm text-slate-500">No report cards uploaded yet.</p>
          ) : (
            <ul className="space-y-2">
              {reportCards.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
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
