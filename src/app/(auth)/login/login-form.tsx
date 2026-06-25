"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AuthBrandLogo } from "@/components/auth/auth-brand-logo";
import { ParticipantAuthLayout } from "@/components/auth/participant-auth-layout";
import { ParticipantAuthLogo } from "@/components/auth/participant-auth-logo";
import { StaffAuthLayout } from "@/components/auth/staff-auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { isStaffAuthLogin } from "@/lib/auth-ui";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const activated = searchParams.get("activated") === "1";
  const staffLogin = isStaffAuthLogin(callbackUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const form = (
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-0 px-6 pb-4 pt-8 text-center">
        {staffLogin ? <AuthBrandLogo /> : <ParticipantAuthLogo />}
        <p className="mt-4 text-center text-sm font-medium">Sign in to your account</p>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {activated ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-900">
              Account activated. Please sign in.
            </p>
          ) : null}
          {error && (
            <p
              className={
                staffLogin
                  ? "text-center text-sm text-red-600 dark:text-red-400"
                  : "text-center text-sm text-red-600"
              }
            >
              {error}
            </p>
          )}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
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
              autoComplete="current-password"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            variant={staffLogin ? "default" : "participant"}
            className="w-full"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <p
            className={
              staffLogin
                ? "text-center text-sm text-slate-600 dark:text-slate-400"
                : "text-center text-sm text-slate-600"
            }
          >
            New participants need an enrolment link from their study coordinator.
          </p>
        </CardFooter>
      </form>
    </Card>
  );

  if (staffLogin) {
    return <StaffAuthLayout>{form}</StaffAuthLayout>;
  }

  return <ParticipantAuthLayout>{form}</ParticipantAuthLayout>;
}
