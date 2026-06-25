"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  participantDashboardCardClassName,
  participantDashboardHeadingClassName,
  participantDashboardInputClassName,
  participantDashboardLabelClassName,
} from "@/lib/participant-dashboard-ui";
import { cn } from "@/lib/utils";

export function ContactForm() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.subject?.[0] ?? data.error?.message?.[0] ?? "Failed to send.");
        return;
      }
      setSent(true);
      setSubject("");
      setMessage("");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Card className={participantDashboardCardClassName}>
        <CardContent className="py-8 text-center">
          <p className="font-medium text-[#2F8F7A]">
            Message sent. We&apos;ll get back to you soon.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={participantDashboardCardClassName}>
      <CardHeader>
        <CardTitle className={cn("text-base", participantDashboardHeadingClassName)}>
          Send a message
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div>
            <label className={participantDashboardLabelClassName} htmlFor="category">
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={cn("mt-1 w-full rounded-lg px-3 py-2 text-sm", participantDashboardInputClassName)}
            >
              <option value="general">General</option>
              <option value="technical">Technical</option>
              <option value="study">Study questions</option>
            </select>
          </div>
          <div>
            <label className={participantDashboardLabelClassName} htmlFor="subject">
              Subject
            </label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className={cn("mt-1", participantDashboardInputClassName)}
              placeholder="Brief subject"
            />
          </div>
          <div>
            <label className={participantDashboardLabelClassName} htmlFor="message">
              Message
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={5}
              className={cn("mt-1 w-full rounded-lg px-3 py-2 text-sm", participantDashboardInputClassName)}
              placeholder="Your message…"
            />
          </div>
          <Button type="submit" disabled={sending}>
            {sending ? "Sending…" : "Send message"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
