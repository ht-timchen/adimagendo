"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function MarkCompleteButton({
  templateId,
  disabled: disabledProp = false,
}: {
  templateId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    if (disabledProp) return;
    setLoading(true);
    try {
      const res = await fetch("/api/checklist/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleClick}
      disabled={disabledProp || loading}
      className={disabledProp ? "cursor-not-allowed opacity-50" : undefined}
    >
      {loading ? "…" : "Mark complete"}
    </Button>
  );
}
