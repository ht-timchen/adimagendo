export function ChecklistLevelLabel({ label }: { label: string }) {
  return (
    <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-participant-primary">
      {label}
    </p>
  );
}
