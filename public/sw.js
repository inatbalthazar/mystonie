// Mystonie service worker.
// - Offline (S3 offline, ADR 0042): pages the user opens are kept on the device with the app's own files and the
//   posters on them, so the installed app opens offline. Always network first: a saved copy is used only when the
//   network fails (or takes over 8 s for a page this device has a copy of). The changes made offline wait in the
//   page's outbox (src/components/offline/outbox.ts), not here.
// - Weekly Recap notifications (ADR 0028).
// Registered for every visitor by SyncProvider (src/components/offline/sync-provider.tsx), which also asks it to save
// pages ("save" messages). Signing out deletes the pages and posters (src/components/offline/offline-data.ts).

const PAGES = "mystonie-pages-v1"; // the HTML of pages opened (user data: deleted on sign-out)
const SHELL = "mystonie-shell-v1"; // the offline page, never trimmed
const ASSETS = "mystonie-assets-v1"; // the app's files: /_next/static, the logo and icons (the same for everyone)
const IMAGES = "mystonie-images-v1"; // posters and covers
const CURRENT = [PAGES, SHELL, ASSETS, IMAGES];
const LIMITS = { [PAGES]: 40, [ASSETS]: 1000, [IMAGES]: 400 };
// Locale prefixes, as in src/i18n/routing.ts (English has none).
const LOCALES = ["th"];
// Pages never kept: sign-in, unsubscribe links, the card lab (development).
const SKIP = /^\/(?:auth|unsubscribe|card-lab)(?:\/|$)/;
// Also allowed in this worker's Content-Security-Policy (next.config.ts), which its own fetches follow.
const POSTER_HOSTS = ["image.tmdb.org", "s4.anilist.co", "media.rawg.io"];
const PAGE_TIMEOUT_MS = 8000;
// In a page's HTML: its scripts, styles and fonts ("/_next/static/…", or "static/chunks/…" in the React data), and
// the site's own images (the logo, the TMDB logo, icons).
const ASSET_URL = /\/_next\/static\/[^"'\s)\\<>]+|(?<=")static\/chunks\/[^"'\s)\\<>]+/g;
const IMAGE_URL = /(?:src|href)="(\/(?!\/|api\/|_next\/)[^"?#]+\.(?:svg|png|webp|jpe?g|gif|avif|ico)(?:\?[^"]*)?)"/g;
// In a style sheet: its fonts.
const CSS_URL = /url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/g;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      // Caches of earlier versions of this file.
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("mystonie-") && !CURRENT.includes(name)).map((name) => caches.delete(name)));
      // Pages start loading while this worker starts up (network first costs no extra wait).
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  ),
);

/** "/th/collection" → { prefix: "/th", path: "/collection" }. */
function splitLocale(pathname) {
  const first = pathname.split("/")[1];
  return LOCALES.includes(first) ? { prefix: `/${first}`, path: pathname.slice(first.length + 1) || "/" } : { prefix: "", path: pathname };
}

/** Where a page is kept: its URL without the query, or null for pages never kept and URLs with other queries. */
function pageKey(url) {
  if (url.origin !== self.location.origin) return null;
  const { path } = splitLocale(url.pathname);
  if (path.startsWith("/api/") || SKIP.test(path)) return null;
  const params = new URLSearchParams(url.search);
  params.delete("source"); // the installed app starts at /home?source=pwa
  return [...params.keys()].length > 0 ? null : url.origin + url.pathname;
}

const isOffline = (path) => splitLocale(path).path === "/offline";

/** Keeps the newest `limit` entries (the Cache API keeps insertion order, and saving again moves an entry last). */
async function trim(name) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - LIMITS[name]))) await cache.delete(key);
}

/** Saves the files at `urls` that aren't saved yet; returns the style sheets' text (for their fonts). */
async function keepFiles(cache, urls) {
  const sheets = [];
  await Promise.all(
    [...new Set(urls)].map(async (url) => {
      const css = new URL(url).pathname.endsWith(".css");
      let response = await cache.match(url);
      if (!response) {
        try {
          response = await fetch(url);
          if (!response.ok) return;
          await cache.put(url, response.clone());
        } catch {
          return; // offline again: next time
        }
      }
      if (css) sheets.push({ url, text: await response.text() });
    }),
  );
  return sheets;
}

/**
 * The app's files a page needs, so it also works when opened offline later: its scripts and styles, the fonts those
 * styles name (all of them, ~400 KB once, as the browser only fetches the ones a page's text needs), and the site's
 * own images on it.
 */
async function keepAssets(html) {
  const cache = await caches.open(ASSETS);
  const at = (path) => new URL(path.replaceAll("&amp;", "&"), self.location.origin).href;
  const files = (html.match(ASSET_URL) || []).map((path) => at(path.startsWith("/") ? path : `/_next/${path}`));
  const images = [...html.matchAll(IMAGE_URL)].map((match) => at(match[1]));
  const sheets = await keepFiles(cache, [...files, ...images]);
  const fonts = sheets.flatMap(({ url, text }) => [...text.matchAll(CSS_URL)].map((match) => new URL(match[1], url)));
  await keepFiles(
    cache,
    fonts.filter((font) => font.origin === self.location.origin && font.pathname.startsWith("/_next/static/")).map((font) => font.href),
  );
  await trim(ASSETS);
}

/** Saves a page's HTML (and its files) under `key`, stamped with when it was saved. */
async function keepPage(key, response) {
  const html = await response.text();
  const name = isOffline(new URL(key).pathname) ? SHELL : PAGES;
  const cache = await caches.open(name);
  await cache.put(key, new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "X-Mystonie-Saved": new Date().toISOString() } }));
  if (name === PAGES) await trim(PAGES);
  await keepAssets(html);
}

const savable = (response) =>
  response.status === 200 && response.type === "basic" && (response.headers.get("Content-Type") || "").startsWith("text/html");

async function savedPage(url) {
  return (await caches.match(url.origin + url.pathname, { cacheName: PAGES })) || null;
}

async function offlinePage(url) {
  const { prefix } = splitLocale(url.pathname);
  const shell = await caches.open(SHELL);
  return (await shell.match(`${url.origin}${prefix}/offline`)) || (await shell.match(`${url.origin}/offline`)) || null;
}

/** Network first; the saved copy when the network fails (or is very slow), else the offline page. */
async function page(event) {
  const url = new URL(event.request.url);
  const key = pageKey(url);
  let keeping = Promise.resolve();
  const network = Promise.resolve(event.preloadResponse)
    .then((preloaded) => preloaded || fetch(event.request))
    .then((response) => {
      if (key && savable(response)) keeping = keepPage(key, response.clone()).catch(() => {});
      return response;
    });
  event.waitUntil(network.then(() => keeping).catch(() => {}));

  let timer;
  const slow = new Promise((resolve) => {
    timer = setTimeout(async () => {
      const copy = await savedPage(url);
      if (copy) resolve(copy);
    }, PAGE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([network, slow]);
  } catch {
    return (await savedPage(url)) || (await offlinePage(url)) || Response.error();
  } finally {
    clearTimeout(timer);
  }
}

/** The app's files: network first (the browser's HTTP cache makes it fast), the saved copy offline. */
async function asset(event) {
  const cache = await caches.open(ASSETS);
  try {
    const response = await fetch(event.request);
    if (response.ok && response.type === "basic") {
      const copy = response.clone();
      event.waitUntil(cache.match(event.request).then((hit) => (hit ? null : cache.put(event.request, copy).then(() => trim(ASSETS)))).catch(() => {}));
    }
    return response;
  } catch (error) {
    const hit = await cache.match(event.request);
    if (hit) return hit;
    throw error;
  }
}

/**
 * Posters: a poster URL never changes, so a saved copy is used first. Fetched with CORS (the catalogs allow it, and
 * cards draw posters on a canvas), so the copy is readable and its real size counts, not a padded opaque one.
 */
async function poster(event) {
  const cache = await caches.open(IMAGES);
  const url = event.request.url;
  const hit = await cache.match(url);
  if (hit) return hit;
  try {
    const response = await fetch(url, { mode: "cors", credentials: "omit" });
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(cache.put(url, copy).then(() => trim(IMAGES)).catch(() => {}));
    }
    return response;
  } catch {
    return fetch(event.request);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    if (url.origin === self.location.origin) event.respondWith(page(event));
    return;
  }
  const same = url.origin === self.location.origin;
  if (same && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(asset(event));
  } else if (POSTER_HOSTS.includes(url.hostname) || (same && url.pathname.startsWith("/api/covers/"))) {
    event.respondWith(poster(event));
  } else if (same && request.destination === "image" && !url.pathname.startsWith("/api/")) {
    // The site's own images (the logo, the TMDB logo): like the app's files.
    event.respondWith(asset(event));
  }
  // Everything else (the API, data requests, analytics) goes to the network as if there were no service worker.
});

// The page asks for copies of pages (Home, the collection, the one it is on, the offline page) to be saved.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "save" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    Promise.all(
      data.urls.slice(0, 5).map(async (href) => {
        let url;
        try {
          url = new URL(href);
        } catch {
          return;
        }
        const key = pageKey(url);
        if (!key) return;
        try {
          const response = await fetch(key, { credentials: "same-origin", headers: { Accept: "text/html" } });
          if (savable(response) && !response.redirected) await keepPage(key, response);
        } catch {
          // offline: kept next time
        }
      }),
    ),
  );
});

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
