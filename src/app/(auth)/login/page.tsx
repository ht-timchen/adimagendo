import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { ParticipantAuthLayout } from "@/components/auth/participant-auth-layout";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <ParticipantAuthLayout>
      <div className="h-[420px] w-full max-w-sm animate-pulse rounded-xl border border-slate-200 bg-white/80 shadow-sm" />
    </ParticipantAuthLayout>
  );
}
