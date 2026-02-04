import { auth } from "@/auth";
import { AbsenceTracker } from "@/components/absence-tracker";

export default async function AbsencesPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Absence tracking</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Record days you were absent from work or school.
        </p>
      </div>
      <AbsenceTracker />
    </div>
  );
}
