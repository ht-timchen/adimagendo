"use client";

import { useEffect } from "react";
import { markContactMessagesSeenAction } from "@/app/(dashboard)/dashboard/admin/_actions";

export function MarkContactMessagesSeen() {
  useEffect(() => {
    void markContactMessagesSeenAction();
  }, []);

  return null;
}
