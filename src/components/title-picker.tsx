"use client";

import { FlameIcon, SearchIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { CardStudio } from "@/cards/card-studio";
import { tmdbImageUrl } from "@/core/catalog/tmdb";
import type { SearchResult, Title } from "@/core/catalog/types";
import { localDateString } from "@/core/cards/edit";
import type { CardData } from "@/core/cards/types";
import { MIN_SEARCH_CHARS, PosterButton, SearchStatus, useTitleSearch } from "./title-search";
import { WaitlistForm } from "./waitlist-form";

type Picked = { result: SearchResult; title?: Title; failed?: boolean };

/** First-screen search-as-you-type + trending chips. Picking a title loads its details. */
export function TitlePicker({ trending, host }: { trending: SearchResult[]; host: string }) {
  const t = useTranslations("Home");
  const inputId = useId();
  const [query, setQuery] = useState("");
  const search = useTitleSearch(query);
  const [picked, setPicked] = useState<Picked | null>(null);
  const pickedRef = useRef<HTMLDivElement>(null);

  const q = query.trim();

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

  const showResults = q.length >= MIN_SEARCH_CHARS;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t("searchLabel")}
        </label>
        <div className="relative">
          <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            enterKeyHint="search"
            className="h-14 w-full rounded-2xl border border-input bg-card pr-4 pl-12 text-base shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-ring/20"
          />
        </div>
        <SearchStatus query={query} search={search} />
      </div>

      <div ref={pickedRef} className="scroll-mt-4">
        {picked && <PickedTitle picked={picked} host={host} onClear={() => setPicked(null)} />}
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
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <FlameIcon aria-hidden className="size-4 text-brand" />
              {t("trendingTitle")}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {trending.map((r) => (
                <li key={`${r.kind}-${r.externalId}`}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-card py-1 pr-4 pl-1 text-sm font-medium shadow-xs transition-colors hover:border-brand/50 hover:bg-brand-soft"
                  >
                    {r.imageUrl ? (
                      <Image src={r.imageUrl} alt="" width={28} height={42} unoptimized crossOrigin="anonymous" className="h-9 w-6 rounded-full object-cover" />
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

      {/* Once a title is picked, the card editor asks after Share / Download instead. */}
      {!picked && <WaitlistForm placement="home" />}
    </div>
  );
}

function cardData(result: SearchResult, title?: Title): CardData {
  return {
    kind: result.kind,
    name: result.name,
    year: result.year,
    posterUrl: title?.posterPath ? tmdbImageUrl(title.posterPath, "w780") : result.imageUrl,
    genres: title?.genres,
    runtimeMin: title?.runtimeMin,
    episodeCount: title?.episodeCount,
    seasonCount: title?.seasonCount,
    finishedOn: localDateString(new Date()),
  };
}

function PickedTitle({ picked, host, onClear }: { picked: Picked; host: string; onClear: () => void }) {
  const t = useTranslations("Home");
  const { result, title, failed } = picked;
  const loading = !title && !failed;
  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em]">{result.name}</h2>
          <p className="text-sm text-muted-foreground">
            {t("titleMeta", { kind: result.kind, year: result.year ?? "none" })}
          </p>
          {failed && <p className="text-sm text-destructive">{t("detailsError")}</p>}
        </div>
        <button type="button" onClick={onClear} aria-label={t("clearPick")} className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-accent">
          <XIcon className="size-5" />
        </button>
      </div>
      {loading ? (
        <div className="mx-auto aspect-[9/16] w-full max-w-sm animate-pulse rounded-xl bg-muted" />
      ) : (
        <CardStudio key={`${result.kind}-${result.externalId}`} data={cardData(result, title)} paletteSource={result.imageUrl} host={host} />
      )}
    </section>
  );
}
