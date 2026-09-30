"use client";

import { ArrowLeftIcon, CloudOffIcon, SearchIcon } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { SEARCH_TYPES, type SearchResult, type SearchType } from "@/core/catalog/types";
import { finishedAtForDate, type EntryStatus } from "@/core/collection/entries";
import { shelfOfKind } from "@/core/collection/view";
import { localDateKey } from "@/core/stats/period";
import { cn } from "@/lib/utils";
import { useOnline } from "../offline/outbox";
import { rememberTitles, useRecentTitles } from "../offline/recent-titles";
import { Sheet } from "../sheet";
import { MIN_SEARCH_CHARS, PosterButton, SearchStatus, useTitleSearch } from "../title-search";
import { useSearchBadges, useWarningLabel } from "../warnings/warning-badge";

/**
 * The ➕ sheet (S1 collection): search → tap a result → tap a status. Three taps from the ➕ to a
 * finished title; the finish date is today unless changed first. A switcher narrows the search to movies & TV,
 * books or manga (S2 books & manga), or games (S3 games); All searches every catalog. Offline, titles seen lately on this device stand in
 * for the search (S3 offline).
 */
export function QuickAdd({
  open,
  onClose,
  onAdd,
  timeZone,
  initialPick = null,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (result: SearchResult, status: EntryStatus, finishedAt: string | null) => void;
  timeZone: string;
  /** Start on this title's status step instead of the search. */
  initialPick?: SearchResult | null;
}) {
  const t = useTranslations("Collection");
  return (
    <Sheet open={open} onClose={onClose} title={t("add")} closeLabel={t("close")}>
      <QuickAddSteps onAdd={onAdd} timeZone={timeZone} initialPick={initialPick} />
    </Sheet>
  );
}

function QuickAddSteps({
  onAdd,
  timeZone,
  initialPick,
}: {
  onAdd: (r: SearchResult, s: EntryStatus, f: string | null) => void;
  timeZone: string;
  initialPick: SearchResult | null;
}) {
  const t = useTranslations("Collection");
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SearchType>("all");
  const search = useTitleSearch(query, type);
  const [picked, setPicked] = useState<SearchResult | null>(initialPick);
  // S2 content warnings: badges on results with a Yes for one of the user's avoid-topics.
  const badges = useSearchBadges(search.status === "done" ? search.results : null);
  const warningLabel = useWarningLabel();
  const online = useOnline();

  // A picked title is remembered for adding offline later.
  const pick = (result: SearchResult) => {
    rememberTitles([result]);
    setPicked(result);
  };

  if (picked) return <PickStatus result={picked} onBack={() => setPicked(null)} onAdd={onAdd} timeZone={timeZone} />;
  if (!online) return <OfflinePicks onPick={pick} />;

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={t("searchTypes")} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
        {SEARCH_TYPES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={type === value}
            onClick={() => setType(value)}
            className={cn(
              "min-h-10 shrink-0 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap ring-1 transition-colors",
              type === value ? "bg-foreground text-background ring-foreground" : "text-muted-foreground ring-border hover:text-foreground",
            )}
          >
            {t("searchType", { type: value })}
          </button>
        ))}
      </div>
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
          autoFocus
          className="h-14 w-full rounded-2xl border border-input bg-card pr-4 pl-12 text-base shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-ring/20"
        />
      </div>
      <SearchStatus query={query} search={search} />
      {query.trim().length >= MIN_SEARCH_CHARS && search.status === "done" && (
        <ul className="grid grid-cols-3 gap-3">
          {search.results.map((r) => (
            <li key={`${r.source}-${r.kind}-${r.externalId}`}>
              <PosterButton result={r} onPick={pick} warning={warningLabel(badges[`${r.kind}:${r.externalId}`])} />
            </li>
          ))}
        </ul>
      )}
      {query.trim().length < MIN_SEARCH_CHARS && <p className="text-sm text-muted-foreground">{t("addHint")}</p>}
    </div>
  );
}

/** Offline: search can't reach the catalogs, so titles seen lately on this device (searches, title pages, trending). */
function OfflinePicks({ onPick }: { onPick: (r: SearchResult) => void }) {
  const t = useTranslations("Offline");
  const recent = useRecentTitles();
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="flex items-start gap-2.5 rounded-2xl bg-muted px-4 py-3 text-sm">
        <CloudOffIcon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
        {t("searchOffline")}
      </p>
      {recent.length > 0 ? (
        <section aria-labelledby="recent-titles" className="flex flex-col gap-3">
          <h3 id="recent-titles" className="font-hand text-2xl leading-none">
            {t("recentTitles")}
          </h3>
          <ul className="grid grid-cols-3 gap-3">
            {recent.map((r) => (
              <li key={`${r.kind}-${r.externalId}`}>
                <PosterButton result={r} onPick={onPick} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noRecent")}</p>
      )}
    </div>
  );
}

function PickStatus({
  result,
  onBack,
  onAdd,
  timeZone,
}: {
  result: SearchResult;
  onBack: () => void;
  onAdd: (r: SearchResult, s: EntryStatus, f: string | null) => void;
  timeZone: string;
}) {
  const t = useTranslations("Collection");
  const home = useTranslations("Home");
  const format = useFormatter();
  const dateId = useId();
  const [today] = useState(() => localDateKey(Date.now(), timeZone));
  const [date, setDate] = useState(today);
  const finishedAt = finishedAtForDate(date, timeZone);
  const shelf = shelfOfKind(result.kind);
  const game = result.kind === "game";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        {/* A game's key art is landscape: it keeps its shape here. */}
        <span
          className={cn(
            "relative shrink-0 -rotate-2 overflow-hidden rounded-lg bg-muted shadow-md ring-4 ring-card",
            game ? "aspect-video w-32" : "aspect-[2/3] w-20",
          )}
        >
          {result.imageUrl && <Image src={result.imageUrl} alt="" fill unoptimized sizes={game ? "128px" : "80px"} className="object-cover" />}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-display text-xl leading-tight font-extrabold">{result.name}</p>
          <p className="text-sm text-muted-foreground">{home("titleMeta", { kind: result.kind, year: result.year ?? "none" })}</p>
          {result.creator && <p className="text-sm text-muted-foreground">{home("byCreator", { creator: result.creator })}</p>}
          {result.platforms?.length ? (
            <p className="text-sm text-muted-foreground">{format.list(result.platforms, { type: "unit" })}</p>
          ) : null}
          <button type="button" onClick={onBack} className="mt-1 inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-brand">
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            {t("backToSearch")}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!finishedAt}
          onClick={() => onAdd(result, "finished", finishedAt)}
          className="h-14 rounded-2xl bg-brand text-lg font-extrabold tracking-wide text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-50"
        >
          {t("statusLabel", { status: "finished", shelf })}
        </button>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <label htmlFor={dateId}>{t("finishedOn")}</label>
          <input
            id={dateId}
            type="date"
            value={date}
            max={today}
            min="1900-01-01"
            required
            onChange={(e) => setDate(e.target.value)}
            className="h-11 rounded-lg border border-input bg-card px-2 text-foreground"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["watching", "want"] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onAdd(result, status, null)}
            className="h-12 rounded-2xl font-semibold ring-1 ring-border hover:bg-muted"
          >
            {t("statusLabel", { status, shelf })}
          </button>
        ))}
      </div>
    </div>
  );
}
