"use client";

import { XIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import type { SearchResult, Title } from "@/core/catalog/types";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; query: string; results: SearchResult[] }
  | { status: "error"; rateLimited: boolean };

type Picked = { result: SearchResult; title?: Title; failed?: boolean };

/** First-screen search-as-you-type + trending chips. Picking a title loads its details. */
export function TitlePicker({ trending }: { trending: SearchResult[] }) {
  const t = useTranslations("Home");
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [picked, setPicked] = useState<Picked | null>(null);
  const pickedRef = useRef<HTMLDivElement>(null);

  const q = query.trim();

  useEffect(() => {
    if (q.length < MIN_CHARS) return;
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

  async function pick(result: SearchResult) {
    setPicked({ result });
    // The panel sits above the results; bring it into view on small screens.
    requestAnimationFrame(() => pickedRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    try {
      const res = await fetch(`/api/titles/${result.source}/${result.kind}/${result.externalId}`);
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { title: Title };
      setPicked((p) => (p?.result === result ? { result, title: body.title } : p));
    } catch {
      setPicked((p) => (p?.result === result ? { result, failed: true } : p));
    }
  }

  const showResults = q.length >= MIN_CHARS;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t("searchLabel")}
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          enterKeyHint="search"
          className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {showResults && search.status === "loading" && t("searching")}
          {showResults && search.status === "error" && (search.rateLimited ? t("rateLimited") : t("searchError"))}
          {showResults && search.status === "done" && search.results.length === 0 && t("noResults", { query: search.query })}
        </p>
      </div>

      <div ref={pickedRef} className="scroll-mt-4">
        {picked && <PickedTitle picked={picked} onClear={() => setPicked(null)} />}
      </div>

      {showResults ? (
        search.status === "done" && (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {search.results.map((r) => (
              <li key={`${r.kind}-${r.externalId}`}>
                <PosterButton result={r} onPick={pick} />
              </li>
            ))}
          </ul>
        )
      ) : (
        trending.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">{t("trendingTitle")}</h2>
            <ul className="flex flex-wrap gap-2">
              {trending.map((r) => (
                <li key={`${r.kind}-${r.externalId}`}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    className="flex min-h-11 items-center gap-2 rounded-full border border-border py-1 pr-4 pl-1 text-sm hover:bg-accent"
                  >
                    {r.imageUrl ? (
                      <Image src={r.imageUrl} alt="" width={28} height={42} unoptimized className="h-9 w-6 rounded-full object-cover" />
                    ) : (
                      <span className="h-9 w-6 rounded-full bg-muted" />
                    )}
                    {r.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </div>
  );
}

function PosterButton({ result, onPick }: { result: SearchResult; onPick: (r: SearchResult) => void }) {
  const t = useTranslations("Home");
  return (
    <button type="button" onClick={() => onPick(result)} className="flex w-full flex-col gap-1 text-left">
      <span className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-muted">
        {result.imageUrl && (
          <Image src={result.imageUrl} alt="" fill unoptimized sizes="(min-width: 640px) 25vw, 33vw" className="object-cover" />
        )}
      </span>
      <span className="line-clamp-2 text-sm font-medium">{result.name}</span>
      <span className="text-xs text-muted-foreground">
        {t("titleMeta", { kind: result.kind, year: result.year ?? "none" })}
      </span>
    </button>
  );
}

function PickedTitle({ picked, onClear }: { picked: Picked; onClear: () => void }) {
  const t = useTranslations("Home");
  const { result, title, failed } = picked;
  return (
    <section className={cn("flex gap-4 rounded-2xl border border-border p-4", !title && !failed && "animate-pulse")}>
      <span className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-md bg-muted">
        {result.imageUrl && <Image src={result.imageUrl} alt="" fill unoptimized sizes="80px" className="object-cover" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="font-semibold">{result.name}</h2>
        <p className="text-sm text-muted-foreground">
          {t("titleMeta", { kind: result.kind, year: result.year ?? "none" })}
        </p>
        {title && (
          <p className="text-sm text-muted-foreground">
            {title.kind === "series"
              ? t("seriesStats", { episodes: title.episodeCount ?? 0, seasons: title.seasonCount ?? 0 })
              : t("movieStats", { minutes: title.runtimeMin ?? 0 })}
          </p>
        )}
        {failed && <p className="text-sm text-destructive">{t("detailsError")}</p>}
        <p className="mt-auto text-sm">{t("cardComingSoon")}</p>
      </div>
      <button type="button" onClick={onClear} aria-label={t("clearPick")} className="flex size-11 shrink-0 items-center justify-center self-start rounded-full hover:bg-accent">
        <XIcon className="size-5" />
      </button>
    </section>
  );
}
