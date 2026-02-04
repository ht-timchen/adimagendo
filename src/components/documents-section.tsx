"use client";

import { useState } from "react";
import { DocumentUpload } from "@/components/document-upload";
import { DocumentsList } from "@/components/documents-list";

export function DocumentsSection() {
  const [refresh, setRefresh] = useState(0);
  return (
    <div className="space-y-6">
      <DocumentUpload onUpload={() => setRefresh((r) => r + 1)} />
      <div key={refresh}>
        <DocumentsList />
      </div>
    </div>
  );
}
