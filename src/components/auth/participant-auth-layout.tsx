import type { ReactNode } from "react";

export function ParticipantAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="light [color-scheme:light] flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <main className="w-full flex min-h-screen flex-col items-center justify-center">
        {children}
      </main>
    </div>
  );
}
