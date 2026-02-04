import { auth } from "@/auth";
import { DocumentsSection } from "@/components/documents-section";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Upload report cards and view referrals sent to you.
        </p>
      </div>
      <DocumentsSection />
    </div>
  );
}
