"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";
import {
  participantDashboardCardClassName,
  participantDashboardHeadingClassName,
  participantDashboardInputClassName,
  participantDashboardLabelClassName,
  participantDashboardMutedClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";
import {
  participantDocumentUploadErrorMessage,
  validateParticipantDocumentFile,
} from "@/lib/documents/participant-upload";

export function DocumentUpload({ onUpload }: { onUpload?: () => void }) {
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setSuccess(null);

    if (!file) {
      setError(null);
      return;
    }

    const validationError = validateParticipantDocumentFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    setError(validationError);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSuccess(null);

    const file = selectedFile ?? inputRef.current?.files?.[0] ?? null;
    if (!file) {
      setError("Please select a file");
      return;
    }

    const validationError = validateParticipantDocumentFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title || file.name);
      formData.append("type", "REPORT_CARD");

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      let payload: { error?: string } | null = null;
      try {
        payload = (await res.json()) as { error?: string };
      } catch {
        payload = null;
      }

      if (!res.ok) {
        setError(
          participantDocumentUploadErrorMessage(res.status, payload?.error)
        );
        return;
      }

      setTitle("");
      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      setSuccess("Report card uploaded successfully.");
      onUpload?.();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className={participantDashboardCardClassName}>
      <CardHeader>
        <CardTitle className={cn("text-base", participantDashboardHeadingClassName)}>
          Upload report card
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="text-sm font-medium text-[#2F8F7A]" role="status">
              {success}
            </p>
          ) : null}
          <div>
            <label className={participantDashboardLabelClassName} htmlFor="report-card-title">
              Title (optional)
            </label>
            <Input
              id="report-card-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Term 1 report card"
              className={cn("mt-1", participantDashboardInputClassName)}
            />
          </div>
          <div>
            <label className={participantDashboardLabelClassName} htmlFor="report-card-file">
              File (PDF or image)
            </label>
            <input
              id="report-card-file"
              ref={inputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleFileChange}
              className="mt-1 block w-full text-sm text-[#2A6F60] file:mr-3 file:rounded-md file:border file:border-[#2F8F7A]/30 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#1E5D50] hover:file:bg-[#f1faf7]"
            />
            {selectedFile ? (
              <p className={cn("mt-2 text-sm", participantDashboardMutedClassName)}>
                Selected: {selectedFile.name}
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={uploading}>
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
