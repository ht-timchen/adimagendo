"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function MarkCompleteButton({
  templateId,
  disabled: disabledProp = false,
  label = "Mark complete",
}: {
  templateId: string;
  disabled?: boolean;
  label?: string;
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
    <Button size="sm" onClick={handleClick} disabled={disabledProp || loading} locked={disabledProp}>
      {loading ? "…" : label}
    </Button>
  );
}
