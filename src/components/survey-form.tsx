"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  participantDashboardCardClassName,
  participantDashboardHeadingClassName,
  participantDashboardInputClassName,
  participantDashboardLabelClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";

type Question = {
  id: string;
  text: string;
  type: string;
  min?: number;
  max?: number;
};

export function SurveyForm({
  surveyId,
  questions,
  initialAnswers,
  completed,
}: {
  surveyId: string;
  questions: Question[];
  initialAnswers: Record<string, unknown>;
  completed: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string | number>>(
    Object.fromEntries(
      Object.entries(initialAnswers).map(([k, v]) => [
        k,
        typeof v === "number" ? v : String(v ?? ""),
      ])
    )
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/surveys/${surveyId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  if (completed && saved) {
    return (
      <Card className={participantDashboardCardClassName}>
        <CardContent className="py-8 text-center">
          <p className="font-medium text-[#2F8F7A]">
            Survey completed. Thank you!
          </p>
          <Link
            href="/dashboard/surveys"
            className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-[#2F8F7A]/30 bg-white/85 px-4 text-sm font-medium text-[#17483F] hover:bg-[#2F8F7A]/10"
          >
            Back to surveys
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) {
    return (
      <Card className={participantDashboardCardClassName}>
        <CardContent className="py-8 text-center text-[#2A6F60]">
          No questions in this survey.
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className={participantDashboardCardClassName}>
        <CardHeader>
          <CardTitle className={cn("text-base", participantDashboardHeadingClassName)}>
            Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {questions.map((q) => (
            <div key={q.id}>
              <label className={cn("block", participantDashboardLabelClassName)} htmlFor={q.id}>
                {q.text}
              </label>
              {q.type === "scale" && (
                <Input
                  id={q.id}
                  type="number"
                  min={q.min ?? 0}
                  max={q.max ?? 10}
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((p) => ({
                      ...p,
                      [q.id]: e.target.value ? Number(e.target.value) : "",
                    }))
                  }
                  className={cn("mt-2 max-w-[100px]", participantDashboardInputClassName)}
                />
              )}
              {q.type !== "scale" && (
                <Input
                  id={q.id}
                  type="text"
                  value={String(answers[q.id] ?? "")}
                  onChange={(e) =>
                    setAnswers((p) => ({ ...p, [q.id]: e.target.value }))
                  }
                  className={cn("mt-2", participantDashboardInputClassName)}
                />
              )}
            </div>
          ))}
          <Button type="submit" disabled={saving}>
            {saving ? "Submitting…" : completed ? "Update answers" : "Submit survey"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
