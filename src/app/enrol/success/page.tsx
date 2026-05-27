"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight text-violet-700">
            ADIMAGENDO
          </CardTitle>
          <div className="flex flex-col items-center gap-2 pt-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-7 w-7" strokeWidth={2.5} />
            </span>
            <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              You&apos;re enrolled!
            </p>
          </div>
          <CardDescription className="text-center text-sm leading-relaxed">
            Add ADIMAGENDO to your home screen for the best experience over the next 4 years
            of your study.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {platform === "ios" ? (
            <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-700 dark:text-slate-300">
              <li>
                Tap the Share button (􀈂) at the bottom of Safari
              </li>
              <li>Scroll down and tap &quot;Add to Home Screen&quot;</li>
              <li>Tap &quot;Add&quot; in the top right</li>
            </ol>
          ) : platform === "android" ? (
            <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-700 dark:text-slate-300">
              <li>Tap the menu (⋮) in the top right of Chrome</li>
              <li>Tap &quot;Add to Home Screen&quot;</li>
              <li>Tap &quot;Add&quot;</li>
            </ol>
          ) : platform === "desktop" ? (
            <p className="text-center text-sm text-slate-700 dark:text-slate-300">
              You&apos;re all set! Bookmark this page or access it anytime at{" "}
              <span className="font-mono text-violet-700 dark:text-violet-400">
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
            className="w-full bg-violet-600 hover:bg-violet-700"
            onClick={() => router.push("/dashboard")}
          >
            I&apos;ve added it — Go to Dashboard
          </Button>
          <button
            type="button"
            className="text-sm text-violet-600 hover:underline"
            onClick={() => router.push("/dashboard")}
          >
            Skip for now
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
