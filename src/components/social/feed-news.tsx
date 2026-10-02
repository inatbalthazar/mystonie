"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  feedDots,
  needsCheck,
  parseFeedNews,
  reelDone,
  seenArticles,
  seenFollowing,
  withFacts,
  type FeedDots,
  type FeedFacts,
  type FeedNews,
} from "@/core/feed-news";
import { reelDay } from "@/core/reel";
import { cn } from "@/lib/utils";

// The feed's dots (ADR 0054, ADR 0074), kept on this device: `/api/feed/news` says what's newest (asked at most once a
// minute, from the nav island), the feed's tabs and the reel say what you've seen, and the island and the tabs read
// both.

const KEY = "mystonie.feedNews";
const listeners = new Set<() => void>();
let loaded = false;
let current: FeedNews | null = null;

function read(): FeedNews | null {
  if (!loaded) {
    loaded = true;
    try {
      current = parseFeedNews(localStorage.getItem(KEY));
    } catch {
      current = null; // storage blocked: the dots live as long as the page
    }
  }
  return current;
}

function write(next: FeedNews | null) {
  if (!next) return;
  current = next;
  loaded = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not saved: still right on this page.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab opened the feed or asked the server: follow it.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    current = parseFeedNews(event.newValue);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const NONE = "";
const encode = (d: FeedDots) => `${d.following ? "f" : ""}${d.articles ? "a" : ""}${d.reel ? "r" : ""}`;

/** The dots that show. None on the server and until the page is hydrated. */
export function useFeedDots(): FeedDots {
  const code = useSyncExternalStore(
    subscribe,
    () => encode(feedDots(read(), reelDay(Date.now()))),
    () => NONE,
  );
  return { following: code.includes("f"), articles: code.includes("a"), reel: code.includes("r") };
}

/** The pre-paint hint (`<html data-auth>`, src/core/auth.ts): only signed-in pages ask. */
const signedIn = () => document.documentElement.hasAttribute("data-auth");

let asking = false;
async function check() {
  if (asking || !signedIn() || !needsCheck(read(), Date.now())) return;
  asking = true;
  try {
    const res = await fetch("/api/feed/news", { cache: "no-store" });
    if (res.ok) write(withFacts(read(), (await res.json()) as FeedFacts, Date.now()));
  } catch {
    // Offline: the dots wait for the next page.
  } finally {
    asking = false;
  }
}

/** Asks the server what's new on each page (`path`) and when the app comes back to the front, at most once a minute. */
export function useFeedNewsCheck(path: string) {
  useEffect(() => {
    void check();
  }, [path]);
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
}

/** On the Following tab: everything about `user` up to the server's `now` has been seen. */
export function FollowingSeen({ user, now }: { user: string; now: string }) {
  useEffect(() => write(seenFollowing(read(), user, now)), [user, now]);
  return null;
}

/** On the Articles tab: `article` (`articleKey`, the newest) and every older one have been seen. */
export function ArticlesSeen({ user, now, article }: { user: string; now: string; article: string | null }) {
  useEffect(() => write(seenArticles(read(), user, now, article)), [user, now, article]);
  return null;
}

/** The reel's game: today's reel (`day`) is finished, so its dot goes now. */
export function markReelDone(day: string) {
  write(reelDone(read(), day));
}

/** A small coral dot for a feed tab or the Reel chip, when `kind` has news (after hydration). */
export function FeedDot({ kind, className }: { kind: keyof FeedDots; className?: string }) {
  const dots = useFeedDots();
  if (!dots[kind]) return null;
  return <span aria-hidden="true" data-feed-dot={kind} className={cn("size-2 shrink-0 rounded-full bg-brand", className)} />;
}
