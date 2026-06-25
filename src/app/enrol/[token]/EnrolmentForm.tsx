"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ParticipantAuthLayout } from "@/components/auth/participant-auth-layout";
import { ParticipantAuthLogo } from "@/components/auth/participant-auth-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

type EnrolmentFormProps = {
  token: string;
  expiresAt: string;
};

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EnrolmentForm({ token, expiresAt }: EnrolmentFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/enrol/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          dateOfBirth,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
        email?: string;
      };

      if (!res.ok || !data.success) {
        setError(data.error ?? "Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      const registeredEmail = (data.email ?? email).trim().toLowerCase();
      const signInRes = await signIn("credentials", {
        email: registeredEmail,
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        setError("Account created but login failed. Please go to the login page.");
        setLoading(false);
        return;
      }

      router.push("/enrol/success");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <ParticipantAuthLayout>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-0 px-6 pb-4 pt-8 text-center">
          <ParticipantAuthLogo />
          <p className="mt-4 text-center text-sm font-medium">
            Create your study participant account
          </p>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <p className="mt-1 text-xs text-slate-500">
                This link expires on {formatExpiry(expiresAt)}.
              </p>
            </div>

            {error ? (
              <p className="text-center text-sm text-red-600">{error}</p>
            ) : null}

            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Full name
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="dateOfBirth" className="text-sm font-medium">
                Date of birth
              </label>
              <Input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
                autoComplete="bday"
              />
              <p className="text-xs text-slate-500">
                Enter your date of birth as recorded with the study team.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" variant="participant" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create Account & Join Study"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </ParticipantAuthLayout>
  );
}
