"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

function noopSubscribe() {
  return () => {};
}

function getPushSupportClientSnapshot() {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushSubscribeResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "not_supported"
        | "missing_vapid"
        | "permission_denied"
        | "registration_failed"
        | "subscribe_failed"
        | "server_error"
        | "invalid_subscription";
      message?: string;
    };

export function usePushNotification() {
  const isSupported = useSyncExternalStore(
    noopSubscribe,
    getPushSupportClientSnapshot,
    () => false
  );
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!isSupported) return;

    let cancelled = false;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        if (cancelled) return;
        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) setIsSubscribed(!!existing);
      } catch {
        if (!cancelled) setIsSubscribed(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<PushSubscribeResult> => {
    if (typeof window === "undefined") {
      return { ok: false, error: "not_supported" };
    }

    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) {
      return { ok: false, error: "not_supported" };
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey?.trim()) {
      return { ok: false, error: "missing_vapid" };
    }

    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;
    } catch (e) {
      return {
        ok: false,
        error: "registration_failed",
        message: e instanceof Error ? e.message : String(e),
      };
    }

    try {
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        if (Notification.permission === "denied") {
          return { ok: false, error: "permission_denied" };
        }

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          return { ok: false, error: "permission_denied" };
        }

        const applicationServerKey = urlBase64ToUint8Array(vapidKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const payload = subscription.toJSON();
      if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
        return { ok: false, error: "invalid_subscription" };
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        try {
          await subscription.unsubscribe();
        } catch {
          /* ignore */
        }
        return { ok: false, error: "server_error" };
      }

      setIsSubscribed(true);
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: "subscribe_failed",
        message: e instanceof Error ? e.message : String(e),
      };
    }
  }, []);

  return { isSupported, isSubscribed, subscribe };
}
