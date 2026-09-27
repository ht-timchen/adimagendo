"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ADELAIDE_TIME_ZONE,
  adelaideCivilDate,
  formatAdelaideCivilDate,
  parseCivilDateYmd,
} from "@/lib/dates/adelaide-calendar";
import {
  CLASSIFICATION_REASON_LABELS,
  CLASSIFICATION_REASON_OPTIONS,
  CLASSIFICATION_REASON_TEXT_MAX,
  type ClassificationChangeAction,
  type ClassificationReasonCode,
} from "@/lib/participant/classification-change-reason";
import type { ClassificationHistoryEntry } from "@/lib/participant/classification-history";

export const TEST_DAY0_CONFIRMATION_TEXT =
  "This changes all checklist open and overdue dates for this test account.";

export type ParticipantClassificationCardData = {
  userId: string;
  sourceLabel: string;
  typeLabel: string;
  typeClassName: string;
  canMarkTest: boolean;
  canMarkPilot: boolean;
  canUnmarkTest: boolean;
  lockedReason: string | null;
  isTestAccount: boolean;
  testDateToolsEnabled: boolean;
  /** Current Day 0 from the timing resolver; null when missing. */
  day0Label: string | null;
  day0Ymd: string | null;
  minDateYmd: string;
  maxDateYmd: string;
  history: ClassificationHistoryEntry[];
};

type ClassificationAction = Exclude<ClassificationChangeAction, "edit_test_enrollment_date">;

const ACTION_CONFIG: Record<
  ClassificationAction,
  { title: string; submitLabel: string; busyLabel: string; endpoint: string }
> = {
  mark_test: {
    title: "Mark as test",
    submitLabel: "Mark as test",
    busyLabel: "Saving…",
    endpoint: "mark-test",
  },
  mark_pilot: {
    title: "Mark as pilot",
    submitLabel: "Mark as pilot",
    busyLabel: "Saving…",
    endpoint: "mark-pilot",
  },
  unmark_test: {
    title: "Change back to Unknown",
    submitLabel: "Change to Unknown",
    busyLabel: "Saving…",
    endpoint: "unmark-test",
  },
};

const historyTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: ADELAIDE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatHistoryTimestamp(iso: string): string {
  const instant = new Date(iso);
  return `${formatAdelaideCivilDate(adelaideCivilDate(instant))}, ${historyTimeFormatter.format(instant)}`;
}

function formatYmdLabel(ymd: string): string {
  const civil = parseCivilDateYmd(ymd);
  return civil ? formatAdelaideCivilDate(civil) : ymd;
}

type ReasonState = { code: ClassificationReasonCode | ""; text: string };

function reasonIsComplete(reason: ReasonState): boolean {
  if (!reason.code) return false;
  return reason.code !== "OTHER" || reason.text.trim().length > 0;
}

async function postChange(
  userId: string,
  endpoint: string,
  method: "POST" | "PATCH",
  body: Record<string, unknown>
): Promise<string | null> {
  try {
    const res = await fetch(`/api/admin/participants/${userId}/${endpoint}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return data?.error ?? "Something went wrong. Please try again.";
  } catch {
    return "Network error. Please try again.";
  }
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function ReasonFields({
  action,
  reason,
  busy,
  onChange,
}: {
  action: ClassificationChangeAction;
  reason: ReasonState;
  busy: boolean;
  onChange: (next: ReasonState) => void;
}) {
  const isOther = reason.code === "OTHER";
  const groupName = `reason-${action}`;
  return (
    <fieldset className="space-y-3" disabled={busy}>
      <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Reason
      </legend>
      <div className="space-y-1.5">
        {CLASSIFICATION_REASON_OPTIONS[action].map((code) => (
          <label key={code} className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="radio"
              name={groupName}
              value={code}
              checked={reason.code === code}
              onChange={() => onChange({ ...reason, code })}
            />
            {CLASSIFICATION_REASON_LABELS[code]}
          </label>
        ))}
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor={`${groupName}-text`}
          className="text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          {isOther ? "Details (required)" : "Details (optional)"}
        </label>
        <Input
          id={`${groupName}-text`}
          value={reason.text}
          maxLength={CLASSIFICATION_REASON_TEXT_MAX}
          onChange={(e) => onChange({ ...reason, text: e.target.value })}
          placeholder={isOther ? "Describe the reason" : "Add details if useful"}
          className="rounded-xl"
        />
      </div>
    </fieldset>
  );
}

function ModalError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {message}
    </p>
  );
}

function ClassificationActionModal({
  action,
  data,
  onClose,
  onDone,
}: {
  action: ClassificationAction;
  data: ParticipantClassificationCardData;
  onClose: () => void;
  onDone: () => void;
}) {
  const config = ACTION_CONFIG[action];
  const [reason, setReason] = useState<ReasonState>({ code: "", text: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const message = await postChange(data.userId, config.endpoint, "POST", {
      reasonCode: reason.code,
      reasonText: reason.text.trim() || null,
    });
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    onDone();
  }

  return (
    <ModalShell title={config.title} onClose={busy ? () => {} : onClose}>
      <div className="space-y-2 text-sm text-slate-600">
        {action === "mark_test" ? (
          <>
            <p>
              This account will be counted as <strong>Test</strong> and its Day 0 will come
              from the app profile instead of the REDCap consent date.
            </p>
            <p>
              The current Day 0 ({data.day0Label ?? "Missing"}) is copied to the profile
              first, so no checklist dates move.
            </p>
          </>
        ) : null}
        {action === "mark_pilot" ? (
          <p>
            This account will be counted as a <strong>Pilot</strong> participant. Pilot
            participants cannot be changed back in the app.
          </p>
        ) : null}
        {action === "unmark_test" ? (
          <p>
            This account will be counted as <strong>Unknown</strong>. Day 0 goes back to
            the REDCap consent date and any test enrolment date is discarded.
          </p>
        ) : null}
      </div>
      <div className="mt-4">
        <ReasonFields action={action} reason={reason} busy={busy} onChange={setReason} />
      </div>
      <ModalError message={error} />
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="button"
          className="rounded-xl"
          disabled={busy || !reasonIsComplete(reason)}
          onClick={submit}
        >
          {busy ? config.busyLabel : config.submitLabel}
        </Button>
      </div>
    </ModalShell>
  );
}

function EditTestDay0Modal({
  data,
  onClose,
  onDone,
}: {
  data: ParticipantClassificationCardData;
  onClose: () => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(data.day0Ymd ?? "");
  const [reason, setReason] = useState<ReasonState>({ code: "", text: "" });
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseCivilDateYmd(date);
  const dateInRange = parsed != null && date >= data.minDateYmd && date <= data.maxDateYmd;
  const dateChanged = date !== data.day0Ymd;
  const canContinue = dateInRange && dateChanged && reasonIsComplete(reason);

  async function save() {
    setBusy(true);
    setError(null);
    const message = await postChange(data.userId, "test-enrollment-date", "PATCH", {
      date,
      reasonCode: reason.code,
      reasonText: reason.text.trim() || null,
    });
    setBusy(false);
    if (message) {
      setError(message);
      setStep("edit");
      return;
    }
    onDone();
  }

  return (
    <ModalShell title="Edit test enrolment date" onClose={busy ? () => {} : onClose}>
      {step === "edit" ? (
        <>
          <div className="space-y-1.5">
            <label
              htmlFor="test-day0-date"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Enrolment date (Day 0, Adelaide date)
            </label>
            <Input
              id="test-day0-date"
              type="date"
              value={date}
              min={data.minDateYmd}
              max={data.maxDateYmd}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl"
            />
            <p className="text-xs text-slate-500">
              Current: {data.day0Label ?? "Missing"}. Allowed: {formatYmdLabel(data.minDateYmd)} to{" "}
              {formatYmdLabel(data.maxDateYmd)}.
            </p>
            {date && !dateInRange ? (
              <p className="text-xs text-rose-600">Choose a date in the allowed range.</p>
            ) : null}
            {dateInRange && !dateChanged ? (
              <p className="text-xs text-slate-500">This is already the enrolment date.</p>
            ) : null}
          </div>
          <div className="mt-4">
            <ReasonFields
              action="edit_test_enrollment_date"
              reason={reason}
              busy={busy}
              onChange={setReason}
            />
          </div>
          <ModalError message={error} />
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={!canContinue}
              onClick={() => setStep("confirm")}
            >
              Continue
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            {TEST_DAY0_CONFIRMATION_TEXT}
          </p>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-16 text-slate-500">From</dt>
              <dd className="text-slate-900">{data.day0Label ?? "Missing"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 text-slate-500">To</dt>
              <dd className="font-medium text-slate-900">{formatYmdLabel(date)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 text-slate-500">Reason</dt>
              <dd className="text-slate-900">
                {reason.code ? CLASSIFICATION_REASON_LABELS[reason.code] : ""}
                {reason.text.trim() ? ` — ${reason.text.trim()}` : ""}
              </dd>
            </div>
          </dl>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setStep("edit")}
              disabled={busy}
            >
              Back
            </Button>
            <Button type="button" className="rounded-xl" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save enrolment date"}
            </Button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

function ChangeHistory({ entries }: { entries: ClassificationHistoryEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
        Change history ({entries.length})
      </button>
      {open ? (
        entries.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No classification changes recorded.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-900">{entry.actionLabel}</span>
                  <span className="text-xs text-slate-500">
                    {formatHistoryTimestamp(entry.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-slate-700">
                  {entry.fromLabel} → {entry.toLabel}
                </p>
                {entry.enrollmentDateChange ? (
                  <p className="text-slate-700">
                    Day 0: {entry.enrollmentDateChange.fromLabel} →{" "}
                    {entry.enrollmentDateChange.toLabel}
                  </p>
                ) : null}
                <p className="text-slate-600">
                  Reason: {entry.reasonLabel}
                  {entry.reasonText ? ` — ${entry.reasonText}` : ""}
                </p>
                <p className="text-xs text-slate-500">
                  By {entry.actorName} ({entry.actorRole})
                </p>
              </li>
            ))}
          </ol>
        )
      ) : null}
    </div>
  );
}

export function ParticipantDataClassificationCard({
  data,
}: {
  data: ParticipantClassificationCardData;
}) {
  const router = useRouter();
  const [openAction, setOpenAction] = useState<ClassificationAction | "edit_day0" | null>(null);

  function done() {
    setOpenAction(null);
    router.refresh();
  }

  const hasClassificationAction = data.canMarkTest || data.canMarkPilot || data.canUnmarkTest;

  return (
    <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-brand" />
          Data classification
          <span className="text-xs font-normal text-slate-500">(super admin only)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span>
            <span className="text-slate-500">Source: </span>
            <span className="font-medium text-slate-900">{data.sourceLabel}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-slate-500">Type:</span>
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
                data.typeClassName
              )}
            >
              {data.typeLabel}
            </span>
          </span>
        </div>

        {hasClassificationAction ? (
          <div className="flex flex-wrap gap-2">
            {data.canMarkTest ? (
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpenAction("mark_test")}>
                Mark as test
              </Button>
            ) : null}
            {data.canMarkPilot ? (
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpenAction("mark_pilot")}>
                Mark as pilot
              </Button>
            ) : null}
            {data.canUnmarkTest ? (
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpenAction("unmark_test")}>
                Change back to Unknown
              </Button>
            ) : null}
          </div>
        ) : data.lockedReason ? (
          <p className="text-sm text-slate-500">{data.lockedReason}</p>
        ) : null}

        {data.isTestAccount ? (
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Test tools (test accounts only)
            </p>
            <p className="text-sm text-slate-700">
              Enrolment date (Day 0):{" "}
              <span className="font-medium text-slate-900">{data.day0Label ?? "Missing"}</span>
            </p>
            {data.testDateToolsEnabled ? (
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpenAction("edit_day0")}>
                Edit test enrolment date
              </Button>
            ) : (
              <p className="text-xs text-slate-500">
                Editing the test enrolment date is turned off in this environment.
              </p>
            )}
          </div>
        ) : null}

        <div className="border-t border-slate-100 pt-4">
          <ChangeHistory entries={data.history} />
        </div>
      </CardContent>

      {openAction && openAction !== "edit_day0" ? (
        <ClassificationActionModal
          action={openAction}
          data={data}
          onClose={() => setOpenAction(null)}
          onDone={done}
        />
      ) : null}
      {openAction === "edit_day0" ? (
        <EditTestDay0Modal data={data} onClose={() => setOpenAction(null)} onDone={done} />
      ) : null}
    </Card>
  );
}
