"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { SearchResult } from "@/core/catalog/types";

const DEBOUNCE_MS = 250;
export const MIN_SEARCH_CHARS = 2;

export type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; query: string; results: SearchResult[] }
  | { status: "error"; rateLimited: boolean };

/** Search-as-you-type against /api/search (debounced; older requests are cancelled). */
export function useTitleSearch(query: string): SearchState {
  const q = query.trim();
  const [search, setSearch] = useState<SearchState>({ status: "idle" });

  useEffect(() => {
    if (q.length < MIN_SEARCH_CHARS) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearch({ status: "loading" });
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) return setSearch({ status: "error", rateLimited: res.status === 429 });
        const body = (await res.json()) as { results: SearchResult[] };
        setSearch({ status: "done", query: q, results: body.results });
      } catch {
        if (!controller.signal.aborted) setSearch({ status: "error", rateLimited: false });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  return search;
}

/** "Searching…", errors and "nothing found" under a search field (announced to screen readers). */
export function SearchStatus({ query, search }: { query: string; search: SearchState }) {
  const t = useTranslations("Home");
  const active = query.trim().length >= MIN_SEARCH_CHARS;
  return (
    <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
      {active && search.status === "loading" && t("searching")}
      {active && search.status === "error" && (search.rateLimited ? t("rateLimited") : t("searchError"))}
      {active && search.status === "done" && search.results.length === 0 && t("noResults", { query: search.query })}
    </p>
  );
}

/** A search result as a poster tile. */
export function PosterButton({ result, onPick }: { result: SearchResult; onPick: (r: SearchResult) => void }) {
  const t = useTranslations("Home");
  return (
    <button type="button" onClick={() => onPick(result)} className="group flex w-full flex-col gap-1.5 text-left">
      <span className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted shadow-sm ring-1 ring-black/5 transition-transform group-hover:-translate-y-0.5">
        {result.imageUrl && (
          <Image src={result.imageUrl} alt="" fill unoptimized crossOrigin="anonymous" sizes="(min-width: 640px) 25vw, 33vw" className="object-cover" />
        )}
      </span>
      <span className="line-clamp-2 text-sm font-medium">{result.name}</span>
      <span className="text-xs text-muted-foreground">
        {t("titleMeta", { kind: result.kind, year: result.year ?? "none" })}
      </span>
    </button>
  );
}
