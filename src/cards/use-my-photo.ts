"use client";

import { useEffect, useState } from "react";

// One request per page load, shared by every card editor on the page; Settings forgets it when the photo changes.
let cached: Promise<string | null> | null = null;

function load(): Promise<string | null> {
  cached ??= fetch("/api/account", { cache: "no-store" })
    .then((res) => (res.ok ? (res.json() as Promise<{ avatarUrl?: unknown }>) : null))
    .then((body) => (typeof body?.avatarUrl === "string" ? body.avatarUrl : null))
    .catch(() => {
      cached = null; // offline: ask again next time
      return null;
    });
  return cached;
}

/** After a new photo or none: the next card editor asks again. */
export function forgetMyPhoto(): void {
  cached = null;
}

/**
 * The signed-in person's profile photo, for the card footer's circle before `@username` (ADR 0068). Null while
 * loading, without a photo or signed out (`enabled` false: no username to put it next to).
 */
export function useMyPhoto(enabled: boolean): string | null {
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    load().then((url) => live && setPhoto(url));
    return () => {
      live = false;
    };
  }, [enabled]);
  return enabled ? photo : null;
}
