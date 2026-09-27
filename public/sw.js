// Mystonie service worker (ADR 0028): Weekly Recap notifications only. No fetch handler and no caching, so pages
// always come from the network (offline support is a later project, docs/architecture/offline-sync.md).
// Registered by the notifications switch in Settings (src/components/pwa/push-switch.tsx).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Only same-site paths are opened from a notification.
function samePath(url) {
  try {
    const target = new URL(url, self.location.origin);
    return target.origin === self.location.origin ? target.pathname + target.search : "/home";
  } catch {
    return "/home";
  }
}

self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    // Not JSON: still show something (browsers require a notification for every push).
  }
  const title = typeof message.title === "string" && message.title ? message.title : "Mystonie";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof message.body === "string" ? message.body : "",
      icon: "/pwa/icon-192.png",
      badge: "/pwa/badge-96.png",
      tag: typeof message.tag === "string" ? message.tag : undefined,
      data: { url: samePath(message.url || "/home") },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(samePath(event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client && "navigate" in client) {
          await client.focus();
          return client.navigate(url).catch(() => self.clients.openWindow(url));
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});

// The browser renewed the subscription: tell the server (the session cookie comes along; same origin).
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const options = event.oldSubscription && event.oldSubscription.options;
      const subscription = event.newSubscription || (options ? await self.registration.pushManager.subscribe(options) : null);
      if (!subscription) return;
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), replaces: event.oldSubscription && event.oldSubscription.endpoint }),
      });
    })(),
  );
});
