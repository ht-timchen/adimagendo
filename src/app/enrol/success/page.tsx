"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { ParticipantAuthLayout } from "@/components/auth/participant-auth-layout";
import { ParticipantAuthLogo } from "@/components/auth/participant-auth-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

type Platform = "ios" | "android" | "desktop" | "unknown";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export default function EnrolSuccessPage() {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setPlatform(detectPlatform());
    setOrigin(window.location.origin);
  }, []);

  return (
    <ParticipantAuthLayout>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-0 px-6 pb-2 pt-8 text-center">
          <ParticipantAuthLogo />
          <div className="mt-4 flex flex-col items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-7 w-7" strokeWidth={2.5} />
            </span>
            <p className="text-sm font-medium">You&apos;re enrolled!</p>
          </div>
          <CardDescription className="mt-3 text-center text-sm leading-relaxed">
            Add ADIMAGENDO to your home screen for the best experience over the next 3 years
            of your study.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {platform === "ios" ? (
            <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-700">
              <li>
                Tap the Share button (􀈂) at the bottom of Safari
              </li>
              <li>Scroll down and tap &quot;Add to Home Screen&quot;</li>
              <li>Tap &quot;Add&quot; in the top right</li>
            </ol>
          ) : platform === "android" ? (
            <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-700">
              <li>Tap the menu (⋮) in the top right of Chrome</li>
              <li>Tap &quot;Add to Home Screen&quot;</li>
              <li>Tap &quot;Add&quot;</li>
            </ol>
          ) : platform === "desktop" ? (
            <p className="text-center text-sm text-slate-700">
              You&apos;re all set! Bookmark this page or access it anytime at{" "}
              <span className="font-mono text-[#2F8F7A]">
                {origin || "…"}
              </span>
            </p>
          ) : (
            <p className="text-center text-sm text-slate-500">Loading instructions…</p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            type="button"
            variant="participant"
            className="w-full"
            onClick={() => router.push("/dashboard")}
          >
            I&apos;ve added it — Go to Dashboard
          </Button>
          <button
            type="button"
            className="text-sm text-[#2F8F7A] hover:underline"
            onClick={() => router.push("/dashboard")}
          >
            Skip for now
          </button>
        </CardFooter>
      </Card>
    </ParticipantAuthLayout>
  );
}
