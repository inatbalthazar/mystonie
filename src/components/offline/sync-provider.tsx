"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useTransition } from "react";
import { hasAuthCookie, localizedPath } from "@/core/auth";
import { routing } from "@/i18n/routing";
import { isStandalone } from "../pwa/browser";
import { checkConnection, flush, goOffline, onSettled, pruneSettled, startOutbox } from "./outbox";

// Offline-first (S3 offline, ADR 0042), mounted once in the layout. It
// - registers the service worker that keeps pages for offline use (public/sw.js);
// - starts the outbox, and sends what waits when the connection comes back or the app comes to the front;
// - then refreshes the page's server data (router.refresh), which also brings changes made on other devices;
// - asks the service worker for fresh copies of Home, the collection and this page once changes have gone through.

const SW_URL = "/sw.js";
const DAY_MS = 86_400_000;
/** Back in front after this long in the background: refresh the page's data. */
const AWAY_MS = 5_000;
/** A window focus (desktop) refreshes at most this often. */
const FOCUS_MS = 60_000;

const signedIn = () => hasAuthCookie(document.cookie.split("; ").map((c) => c.split("=")[0]!));

async function activeWorker(): Promise<ServiceWorker | null> {
  const registration = await navigator.serviceWorker?.getRegistration("/");
  return registration?.active ?? null;
}

/** Asks the service worker to keep fresh copies of these pages, with their files, for offline use. */
async function savePages(urls: string[]) {
  (await activeWorker().catch(() => null))?.postMessage({ type: "save", urls });
}

/** Saves the pages the app opens to offline when this device has no copy from the last day. */
async function saveMissing(urls: string[]) {
  const missing: string[] = [];
  for (const url of urls) {
    const copy = await caches.match(url).catch(() => undefined);
    const savedAt = Date.parse(copy?.headers.get("x-mystonie-saved") ?? "");
    if (!copy || !(Date.now() - savedAt < DAY_MS)) missing.push(url);
  }
  if (missing.length > 0) await savePages(missing);
}

export function SyncProvider() {
  const router = useRouter();
  const locale = useLocale();
  const [refreshing, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshedAt = useRef(0);
  const refreshStart = useRef<number | null>(null);
  const hiddenAt = useRef<number | null>(null);
  // Changes went through since the saved copies were made.
  const dirty = useRef(false);

  const pageUrl = useCallback((path: string) => new URL(localizedPath(path, locale, routing.defaultLocale), window.location.origin).href, [locale]);

  /** Fresh server data for this page, soon: a burst of changes makes one refresh. */
  const refreshSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!signedIn()) return;
      refreshedAt.current = refreshStart.current = Date.now();
      startTransition(() => router.refresh());
    }, 300);
  }, [router]);

  // The refresh has landed: ops settled before it started are in the page's data now, and copies for offline use
  // can be made fresh.
  useEffect(() => {
    if (refreshing || refreshStart.current === null) return;
    pruneSettled(refreshStart.current);
    refreshStart.current = null;
    if (dirty.current) {
      dirty.current = false;
      void savePages([...new Set([pageUrl("/home"), pageUrl("/collection"), window.location.href])]);
    }
  }, [refreshing, pageUrl]);

  useEffect(() => {
    startOutbox();

    /** Back online or in front: send what waits, then fresh data (another device may have changed things). */
    const pull = async (minAge: number) => {
      if (!(await checkConnection())) return;
      if (Date.now() - refreshedAt.current > minAge) refreshSoon();
    };
    const stopSettled = onSettled(() => {
      dirty.current = true;
      refreshSoon();
    });
    const onOnline = () => void pull(0);
    const onOffline = () => goOffline();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      const away = hiddenAt.current !== null && Date.now() - hiddenAt.current > AWAY_MS;
      hiddenAt.current = null;
      if (away) void pull(AWAY_MS);
      else void flush();
    };
    const onFocus = () => void pull(FOCUS_MS);
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) void pull(0); // back from the browser's back/forward cache
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onVisibility);

    // For everyone: the app installs and opens offline. Blocked (some private windows): it works online as before.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(SW_URL, { scope: "/", updateViaCache: "none" })
        .then(() => navigator.serviceWorker.ready)
        .then(() => saveMissing([pageUrl("/offline"), ...(signedIn() ? [pageUrl("/home"), pageUrl("/collection")] : [])]))
        .catch(() => {});
    }
    // An installed app asks the browser to keep what it saved (Chromium grants it without a prompt).
    if (isStandalone()) void navigator.storage?.persist?.().catch(() => {});

    return () => {
      stopSettled();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshSoon, pageUrl]);

  return null;
}
