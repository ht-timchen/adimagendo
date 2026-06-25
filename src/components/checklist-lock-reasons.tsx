export function ChecklistLockReasons({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null;
  return (
    <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-amber-800">
      {reasons.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  );
}
