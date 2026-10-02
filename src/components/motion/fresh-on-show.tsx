"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * A page older than this when it shows came from the router's cache (a prefetch, ADR 0075). A refresh also makes the
 * island prefetch its tabs again, so not much lower.
 */
const FRESH_MS = 30_000;

/** Something was saved since the tabs were prefetched: the next one shown refreshes whatever its age. */
let changed = false;

/**
 * Notes every successful change sent to our API (anything but GET to `/api/`), so a tab prefetched before it doesn't
 * stay out of date: a follow on /people, a Stamp, a setting. Installed once, by the nav island.
 */
export function useChangeWatch() {
  useEffect(() => {
    const w = window as typeof window & { __mystonieChangeWatch?: true };
    if (w.__mystonieChangeWatch) return;
    w.__mystonieChangeWatch = true;
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const res = await original(input, init);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (method !== "GET" && res.ok) {
        const url = new URL(input instanceof Request ? input.url : String(input), location.href);
        if (url.origin === location.origin && url.pathname.startsWith("/api/")) changed = true;
      }
      return res;
    };
  }, []);
}

/**
 * Stale-while-revalidate for the app's tab pages (ADR 0075): the nav island prefetches them, so a tap shows one at
 * once, with no skeleton. If what showed was rendered more than 30 seconds ago (`at`, the server's clock), or
 * something was saved since, it asks for a fresh render in the background and the page updates in place. A clock far
 * off either way just refreshes.
 */
export function FreshOnShow({ at }: { at: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!navigator.onLine || (!changed && Math.abs(Date.now() - at) <= FRESH_MS)) return;
    changed = false;
    router.refresh();
  }, [at, router]);
  return null;
}
