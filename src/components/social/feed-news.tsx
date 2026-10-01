"use client";

import { useEffect, useSyncExternalStore } from "react";
import { feedNewsOnFeed, feedNewsOnHome, hasFeedNews, parseFeedNews, type FeedNews } from "@/core/feed-news";

// The Feed tab's dot (ADR 0054), kept on this device: Home writes the newest Stamp or follow about you, the feed
// writes when you opened it, and the nav island reads both. No request of its own.

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
      current = null; // storage blocked: the dot lives as long as the page
    }
  }
  return current;
}

function write(next: FeedNews) {
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
  // Another tab opened the feed (or Home): follow it.
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

/** Whether the Feed tab shows its dot. False on the server and until the page is hydrated. */
export function useFeedNews(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hasFeedNews(read()),
    () => false,
  );
}

/** On Home: the newest Stamp or follow about `user` (null: none yet), as of the server's `now`. */
export function FeedNewsFromHome({ user, latest, now }: { user: string; latest: string | null; now: string }) {
  useEffect(() => write(feedNewsOnHome(read(), user, latest, now)), [user, latest, now]);
  return null;
}

/** On the feed: everything about `user` up to the server's `now` has been seen. */
export function FeedNewsSeen({ user, now }: { user: string; now: string }) {
  useEffect(() => write(feedNewsOnFeed(read(), user, now)), [user, now]);
  return null;
}
