import { auth } from "@/auth";
import { SymptomDiary } from "@/components/symptom-diary";

export default async function SymptomsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Symptom diary</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Log your symptoms by day. Select a date on the calendar to add or edit an entry.
        </p>
      </div>
      <SymptomDiary />
    </div>
  );
}
