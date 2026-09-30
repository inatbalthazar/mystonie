"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isTitleKind, sourceForKind, type SearchResult } from "@/core/catalog/types";

// Titles seen on this device lately (S3 offline): quick add offers them when search can't reach the catalogs.
// Remembered from searches, title pages and Home's trending, in localStorage (cleared on sign-out).

const KEY = "mystonie.recent-titles";
const MAX = 24;
const NONE: SearchResult[] = [];
const listeners = new Set<() => void>();
let current: SearchResult[] | null = null;

const keyOf = (t: Pick<SearchResult, "kind" | "externalId">) => `${t.kind}:${t.externalId}`;

function isResult(value: unknown): value is SearchResult {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    isTitleKind(t.kind) &&
    t.source === sourceForKind(t.kind) &&
    typeof t.externalId === "string" &&
    typeof t.name === "string"
  );
}

const slim = ({ source, kind, externalId, name, year, imageUrl, creator, platforms }: SearchResult): SearchResult => ({
  source,
  kind,
  externalId,
  name,
  ...(year ? { year } : {}),
  ...(imageUrl ? { imageUrl } : {}),
  ...(creator ? { creator } : {}),
  ...(platforms?.length ? { platforms } : {}),
});

function read(): SearchResult[] {
  if (current) return current;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    current = Array.isArray(parsed) ? parsed.filter(isResult).slice(0, MAX) : [];
  } catch {
    current = [];
  }
  return current;
}

function write(next: SearchResult[]) {
  current = next.slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Storage blocked: remembered for this visit only.
  }
  for (const listener of listeners) listener();
}

/** Remembers titles, newest first; `later` adds them after the ones already there (Home's trending). */
export function rememberTitles(titles: readonly SearchResult[], later = false) {
  const fresh = titles.filter(isResult).map(slim);
  const had = read();
  if (later) {
    const known = new Set(had.map(keyOf));
    write([...had, ...fresh.filter((t) => !known.has(keyOf(t)))]);
  } else {
    const keys = new Set(fresh.map(keyOf));
    write([...fresh, ...had.filter((t) => !keys.has(keyOf(t)))]);
  }
}

export function forgetRecentTitles() {
  current = [];
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRecentTitles(): SearchResult[] {
  return useSyncExternalStore(subscribe, read, () => NONE);
}

/** Remembers the titles shown on a page (a title page, Home's trending) for offline quick add. Renders nothing. */
export function RememberTitles({ titles, later = false }: { titles: SearchResult[]; later?: boolean }) {
  const key = titles.map(keyOf).join(",");
  useEffect(() => {
    rememberTitles(titles, later);
    // Only when the titles change, not on every render with a new array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, later]);
  return null;
}
