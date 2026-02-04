"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <Card>
        <CardContent className="py-8 text-center">
          <p className="font-medium text-violet-600 dark:text-violet-400">
            Survey completed. Thank you!
          </p>
          <Link
            href="/dashboard/surveys"
            className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-slate-100 px-4 text-sm font-medium hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            Back to surveys
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-500">
          No questions in this survey.
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {questions.map((q) => (
            <div key={q.id}>
              <label className="block text-sm font-medium" htmlFor={q.id}>
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
                  className="mt-2 max-w-[100px]"
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
                  className="mt-2"
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
