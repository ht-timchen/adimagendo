"use client";

import { useActionState } from "react";
import type { ProjectSettings } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProjectSettingsAction } from "@/app/(dashboard)/dashboard/admin/_actions";
import { COMMON_TIMEZONES } from "@/lib/timezones";
import { cn } from "@/lib/utils";

const inputClass =
  "rounded-xl border-slate-200 focus-visible:ring-violet-500 dark:border-slate-700";

export function ProjectSettingsForm({ initial }: { initial: ProjectSettings }) {
  const [state, formAction] = useActionState(updateProjectSettingsAction, null);

  const tzOptions: string[] = [...COMMON_TIMEZONES];
  const tz = initial.timeZone?.trim();
  if (tz && !tzOptions.includes(tz)) {
    tzOptions.unshift(tz);
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="projectName" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Project name
        </label>
        <Input id="projectName" name="projectName" required defaultValue={initial.projectName} className={inputClass} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Project description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={initial.description}
          className={cn(
            "flex w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-offset-white placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:ring-offset-slate-950"
          )}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="projectId" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Project ID
        </label>
        <Input id="projectId" name="projectId" defaultValue={initial.projectId} className={inputClass} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="startDate" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Start date
          </label>
          <Input id="startDate" name="startDate" type="date" defaultValue={initial.startDate || ""} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="endDate" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            End date
          </label>
          <Input id="endDate" name="endDate" type="date" defaultValue={initial.endDate || ""} className={inputClass} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="status" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Project status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={["Active", "Paused", "Completed"].includes(initial.status) ? initial.status : "Active"}
          className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="Active">Active</option>
          <option value="Paused">Paused</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="timeZone" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Time zone
        </label>
        <select
          id="timeZone"
          name="timeZone"
          defaultValue={tz && tzOptions.includes(tz) ? tz : tzOptions[0]}
          className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900"
        >
          {tzOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {state?.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Settings saved successfully.
        </p>
      ) : null}

      <Button type="submit" className="rounded-xl">
        Save changes
      </Button>
    </form>
  );
}
