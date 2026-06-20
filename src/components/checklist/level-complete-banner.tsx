"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  notificationId: string;
  message: string;
};

export function LevelCompleteBanner({ notificationId, message }: Props) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  async function dismiss() {
    setDismissing(true);
    try {
      const res = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
      });
      if (!res.ok) return;
      setHidden(true);
      router.refresh();
    } finally {
      setDismissing(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
      <p className="font-medium">🎉 {message}</p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 shrink-0 p-0 text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
        disabled={dismissing}
        aria-label="Dismiss"
        onClick={dismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
