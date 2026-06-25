"use client";

import { useState, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  parseISO,
  isSameMonth,
} from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  participantDashboardBodyClassName,
  participantDashboardCalendarDayClassName,
  participantDashboardCalendarDayHasEntryClassName,
  participantDashboardCalendarDayOutsideClassName,
  participantDashboardCalendarMutedClassName,
  participantDashboardCardClassName,
  participantDashboardHeadingClassName,
  participantDashboardInputClassName,
  participantDashboardLabelClassName,
  participantDashboardMutedClassName,
} from "@/lib/participant-dashboard-ui";

const REASONS = [
  { value: "MEDICAL", label: "Medical" },
  { value: "SYMPTOMS", label: "Symptoms" },
  { value: "APPOINTMENT", label: "Appointment" },
  { value: "OTHER", label: "Other" },
] as const;

type AbsenceEntry = {
  id: string;
  date: string;
  halfDay: boolean;
  reason: string;
  context: string | null;
  notes: string | null;
};

export function AbsenceTracker() {
  const [currentMonth, setCurrentMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [entries, setEntries] = useState<AbsenceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    halfDay: false,
    reason: "MEDICAL" as const,
    context: "school",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/absences?month=${currentMonth}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [currentMonth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          halfDay: form.halfDay,
          reason: form.reason,
          context: form.context || undefined,
          notes: form.notes || undefined,
        }),
      });
      if (res.ok) {
        await loadEntries();
        setForm((p) => ({ ...p, notes: "" }));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/absences?id=${id}`, { method: "DELETE" });
    if (res.ok) await loadEntries();
  };

  const [y, m] = currentMonth.split("-").map(Number);
  const monthStart = startOfMonth(new Date(y, m - 1));
  const monthEnd = endOfMonth(new Date(y, m - 1));
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEntriesForDate = (d: Date) => {
    const key = format(d, "yyyy-MM-dd");
    return entries.filter((e) => format(parseISO(e.date), "yyyy-MM-dd") === key);
  };

  return (
    <div className="space-y-6">
      <Card className={participantDashboardCardClassName}>
        <CardHeader>
          <CardTitle className={cn("text-base", participantDashboardHeadingClassName)}>Log entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={participantDashboardLabelClassName}>Date</label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className={cn("mt-1", participantDashboardInputClassName)}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="halfDay"
                checked={form.halfDay}
                onChange={(e) => setForm((p) => ({ ...p, halfDay: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300"
              />
              <label htmlFor="halfDay" className={cn("text-sm", participantDashboardBodyClassName)}>
                Half day only
              </label>
            </div>
            <div>
              <label className={participantDashboardLabelClassName}>Reason</label>
              <select
                value={form.reason}
                onChange={(e) =>
                  setForm((p) => ({ ...p, reason: e.target.value as typeof form.reason }))
                }
                className={cn("mt-1 w-full rounded-lg px-3 py-2 text-sm", participantDashboardInputClassName)}
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={participantDashboardLabelClassName}>Context</label>
              <select
                value={form.context}
                onChange={(e) => setForm((p) => ({ ...p, context: e.target.value }))}
                className={cn("mt-1 w-full rounded-lg px-3 py-2 text-sm", participantDashboardInputClassName)}
              >
                <option value="school">School</option>
                <option value="work">Work</option>
              </select>
            </div>
            <div>
              <label className={participantDashboardLabelClassName}>Notes (optional)</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                className={cn("mt-1", participantDashboardInputClassName)}
                placeholder="Optional…"
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Add entry"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className={participantDashboardCardClassName}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className={cn("text-base", participantDashboardHeadingClassName)}>Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(format(subMonths(monthStart, 1), "yyyy-MM"))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className={cn("min-w-[120px] text-center font-medium", participantDashboardBodyClassName)}>
              {format(monthStart, "MMMM yyyy")}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(format(addMonths(monthStart, 1), "yyyy-MM"))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className={cn("text-sm", participantDashboardMutedClassName)}>Loading…</p>
          ) : (
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className={participantDashboardCalendarMutedClassName}>
                  {day}
                </div>
              ))}
              {days.map((d) => {
                const dayEntries = getEntriesForDate(d);
                const hasEntry = dayEntries.length > 0;
                return (
                  <div
                    key={format(d, "yyyy-MM-dd")}
                    className={cn(
                      participantDashboardCalendarDayClassName,
                      hasEntry && participantDashboardCalendarDayHasEntryClassName,
                      !isSameMonth(d, monthStart) && participantDashboardCalendarDayOutsideClassName
                    )}
                  >
                    {format(d, "d")}
                    {dayEntries.length > 0 && (
                      <span className="ml-1 text-xs">({dayEntries.length})</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={participantDashboardCardClassName}>
        <CardHeader>
          <CardTitle className={cn("text-base", participantDashboardHeadingClassName)}>
            This month&apos;s diary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className={cn("text-sm", participantDashboardMutedClassName)}>
              No diary entries for this month.
            </p>
          ) : (
            <ul className="space-y-2">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-lg border border-[#2F8F7A]/20 bg-white/70 px-3 py-2 text-sm text-[#17483F]"
                >
                  <span>
                    {format(parseISO(e.date), "MMM d, yyyy")}
                    {e.halfDay && " (half day)"} · {e.reason}
                    {e.context && ` · ${e.context}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(e.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
