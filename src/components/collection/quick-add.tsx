"use client";

import { ArrowLeftIcon, SearchIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { SearchResult } from "@/core/catalog/types";
import { finishedAtForDate, type EntryStatus } from "@/core/collection/entries";
import { localDateKey } from "@/core/stats/period";
import { Sheet } from "../sheet";
import { MIN_SEARCH_CHARS, PosterButton, SearchStatus, useTitleSearch } from "../title-search";

/**
 * The ➕ sheet (S1 collection): search → tap a result → tap a status. Three taps from the ➕ to a
 * finished title; the finish date is today unless changed first.
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
  const home = useTranslations("Home");
  const inputId = useId();
  const [query, setQuery] = useState("");
  const search = useTitleSearch(query);
  const [picked, setPicked] = useState<SearchResult | null>(initialPick);

  if (picked) return <PickStatus result={picked} onBack={() => setPicked(null)} onAdd={onAdd} timeZone={timeZone} />;

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={inputId} className="sr-only">
        {home("searchLabel")}
      </label>
      <div className="relative">
        <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={home("searchPlaceholder")}
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
            <li key={`${r.kind}-${r.externalId}`}>
              <PosterButton result={r} onPick={setPicked} />
            </li>
          ))}
        </ul>
      )}
      {query.trim().length < MIN_SEARCH_CHARS && <p className="text-sm text-muted-foreground">{t("addHint")}</p>}
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
  const dateId = useId();
  const [today] = useState(() => localDateKey(Date.now(), timeZone));
  const [date, setDate] = useState(today);
  const finishedAt = finishedAtForDate(date, timeZone);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <span className="relative aspect-[2/3] w-20 shrink-0 -rotate-2 overflow-hidden rounded-lg bg-muted shadow-md ring-4 ring-card">
          {result.imageUrl && <Image src={result.imageUrl} alt="" fill unoptimized sizes="80px" className="object-cover" />}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-display text-xl leading-tight font-extrabold">{result.name}</p>
          <p className="text-sm text-muted-foreground">{home("titleMeta", { kind: result.kind, year: result.year ?? "none" })}</p>
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
          {t("statusLabel", { status: "finished" })}
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
            {t("statusLabel", { status })}
          </button>
        ))}
      </div>
    </div>
  );
}
