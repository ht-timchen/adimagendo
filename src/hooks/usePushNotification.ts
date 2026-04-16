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
        | "invalid_subscription"
        | "unsubscribe_failed"
        | "sync_failed";
      message?: string;
    };

type EndpointCheckResult = {
  isCurrentUser: boolean;
};

async function verifyEndpointForCurrentUser(
  endpoint: string
): Promise<EndpointCheckResult | null> {
  try {
    const url = `/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`;
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      isCurrentUser?: boolean;
    };
    return { isCurrentUser: Boolean(data.isCurrentUser) };
  } catch {
    return null;
  }
}

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
        await navigator.serviceWorker.ready;
        let existing = await registration.pushManager.getSubscription();
        if (!existing) {
          if (!cancelled) setIsSubscribed(false);
          return;
        }

        const check = await verifyEndpointForCurrentUser(existing.endpoint);
        if (cancelled) return;

        if (check?.isCurrentUser) {
          setIsSubscribed(true);
          return;
        }

        // Browser has a subscription, but it's not valid for current user.
        // Recreate and save under current user to avoid false "enabled" state.
        try {
          await existing.unsubscribe();
          existing = null;
        } catch {
          if (!cancelled) setIsSubscribed(false);
          return;
        }

        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey?.trim()) {
          if (!cancelled) setIsSubscribed(false);
          return;
        }

        const applicationServerKey = urlBase64ToUint8Array(vapidKey);
        const repaired = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

        const payload = repaired.toJSON();
        if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
          if (!cancelled) setIsSubscribed(false);
          return;
        }

        const saveRes = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (!cancelled) setIsSubscribed(saveRes.ok);
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

      const check = await verifyEndpointForCurrentUser(payload.endpoint);
      if (!check?.isCurrentUser) {
        try {
          await subscription.unsubscribe();
        } catch {
          return { ok: false, error: "sync_failed" };
        }

        const applicationServerKey = urlBase64ToUint8Array(vapidKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const repairedPayload = subscription.toJSON();
      if (
        !repairedPayload.endpoint ||
        !repairedPayload.keys?.p256dh ||
        !repairedPayload.keys?.auth
      ) {
        return { ok: false, error: "invalid_subscription" };
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(repairedPayload),
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

  const unsubscribe = useCallback(async (): Promise<PushSubscribeResult> => {
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

    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setIsSubscribed(false);
        const res = await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ all: true }),
        });
        if (!res.ok) {
          return { ok: false, error: "server_error" };
        }
        return { ok: true };
      }

      const unsubscribed = await subscription.unsubscribe();
      if (!unsubscribed) {
        return { ok: false, error: "unsubscribe_failed" };
      }

      setIsSubscribed(false);

      const res = await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ all: true }),
      });

      if (!res.ok) {
        return { ok: false, error: "server_error" };
      }

      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: "unsubscribe_failed",
        message: e instanceof Error ? e.message : String(e),
      };
    }
  }, []);

  return { isSupported, isSubscribed, subscribe, unsubscribe };
}
