import { auth } from "@/auth";
import { ContactForm } from "@/components/contact-form";

export default async function ContactPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contact us</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Get in touch with the study team.
        </p>
      </div>
      <ContactForm />
    </div>
  );
}
