"use client";

import { useState, useEffect, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  parseISO,
} from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  participantDashboardBodyClassName,
  participantDashboardCalendarDayClassName,
  participantDashboardCalendarDayHasEntryClassName,
  participantDashboardCalendarDayOutsideClassName,
  participantDashboardCalendarDaySelectedClassName,
  participantDashboardCalendarMutedClassName,
  participantDashboardCardClassName,
  participantDashboardHeadingClassName,
  participantDashboardInputClassName,
  participantDashboardLabelClassName,
  participantDashboardMutedClassName,
} from "@/lib/participant-dashboard-ui";

const SYMPTOM_OPTIONS = [
  "cramping",
  "fatigue",
  "bloating",
  "headache",
  "back pain",
  "nausea",
  "other",
];

type SymptomEntry = {
  id: string;
  date: string;
  painLevel: number | null;
  symptoms: string[];
  notes: string | null;
};

export function SymptomDiary() {
  const [currentMonth, setCurrentMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [entries, setEntries] = useState<SymptomEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    painLevel: "",
    symptoms: [] as string[],
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/symptoms?month=${currentMonth}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (!selectedDate) {
      setForm({ painLevel: "", symptoms: [], notes: "" });
      return;
    }
    const entry = entries.find(
      (e) => format(parseISO(e.date), "yyyy-MM-dd") === selectedDate
    );
    if (entry) {
      setForm({
        painLevel: entry.painLevel != null ? String(entry.painLevel) : "",
        symptoms: Array.isArray(entry.symptoms) ? entry.symptoms : [],
        notes: entry.notes ?? "",
      });
    } else {
      setForm({ painLevel: "", symptoms: [], notes: "" });
    }
  }, [selectedDate, entries]);

  const handleSave = async () => {
    if (!selectedDate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/symptoms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          painLevel: form.painLevel ? Number(form.painLevel) : undefined,
          symptoms: form.symptoms,
          notes: form.notes || undefined,
        }),
      });
      if (res.ok) {
        await loadEntries();
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleSymptom = (s: string) => {
    setForm((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(s)
        ? prev.symptoms.filter((x) => x !== s)
        : [...prev.symptoms, s],
    }));
  };

  const [y, m] = currentMonth.split("-").map(Number);
  const monthStart = startOfMonth(new Date(y, m - 1));
  const monthEnd = endOfMonth(new Date(y, m - 1));
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEntryForDate = (d: Date) => {
    const key = format(d, "yyyy-MM-dd");
    return entries.find((e) => format(parseISO(e.date), "yyyy-MM-dd") === key);
  };

  return (
    <div className="space-y-6">
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
                const entry = getEntryForDate(d);
                const dateKey = format(d, "yyyy-MM-dd");
                const isSelected = selectedDate === dateKey;
                const hasEntry = entry && (entry.painLevel != null || (Array.isArray(entry.symptoms) && entry.symptoms.length > 0));
                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => setSelectedDate(dateKey)}
                    className={cn(
                      participantDashboardCalendarDayClassName,
                      isSelected && participantDashboardCalendarDaySelectedClassName,
                      hasEntry && participantDashboardCalendarDayHasEntryClassName,
                      !isSameMonth(d, monthStart) && participantDashboardCalendarDayOutsideClassName
                    )}
                  >
                    {format(d, "d")}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDate && (
        <Card className={participantDashboardCardClassName}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className={cn("text-base", participantDashboardHeadingClassName)}>
              {format(parseISO(selectedDate), "EEEE, MMM d, yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className={participantDashboardLabelClassName}>Pain level (0–10)</label>
              <Input
                type="number"
                min={0}
                max={10}
                value={form.painLevel}
                onChange={(e) => setForm((p) => ({ ...p, painLevel: e.target.value }))}
                className={cn("mt-1 max-w-[80px]", participantDashboardInputClassName)}
              />
            </div>
            <div>
              <label className={participantDashboardLabelClassName}>Symptoms</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SYMPTOM_OPTIONS.map((opt) => (
                  <label
                    key={opt}
                    className={cn(
                      "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors",
                      form.symptoms.includes(opt)
                        ? "border-[#2F8F7A]/40 bg-[#2F8F7A]/15 text-[#17483F]"
                        : "border-[#2F8F7A]/20 bg-white/70 text-[#17483F]"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={form.symptoms.includes(opt)}
                      onChange={() => toggleSymptom(opt)}
                      className="sr-only"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={participantDashboardLabelClassName}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                className={cn("mt-1 w-full rounded-lg px-3 py-2 text-sm", participantDashboardInputClassName)}
                rows={3}
                placeholder="Optional notes…"
              />
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save entry"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
