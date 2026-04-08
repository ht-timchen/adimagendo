self.addEventListener("push", (event) => {
  let title = "ADIMAGENDO";
  let body = "";
  let url = "/";

  if (event.data) {
    try {
      const payload = event.data.json();
      if (typeof payload.title === "string") title = payload.title;
      if (typeof payload.body === "string") body = payload.body;
      if (payload.url !== undefined && payload.url !== null) {
        url = String(payload.url) || "/";
      }
    } catch {
      try {
        const text = event.data.text();
        const payload = JSON.parse(text);
        if (typeof payload.title === "string") title = payload.title;
        if (typeof payload.body === "string") body = payload.body;
        if (payload.url !== undefined && payload.url !== null) {
          url = String(payload.url) || "/";
        }
      } catch {
        body = event.data.text() || body;
      }
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192x192.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url;
  const pathOrUrl = rawUrl != null && String(rawUrl).trim() !== "" ? String(rawUrl) : "/";
  const targetUrl = new URL(pathOrUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          const sameOrigin =
            new URL(client.url).origin === self.location.origin;
          if (
            sameOrigin &&
            "focus" in client &&
            typeof client.navigate === "function"
          ) {
            return client.navigate(targetUrl).then((c) => {
              if (c && "focus" in c) return c.focus();
              return client.focus();
            });
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
