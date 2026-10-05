"use client";

import { ArrowLeftIcon, CloudOffIcon, SearchIcon } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { SEARCH_TYPES, type SearchResult, type SearchType } from "@/core/catalog/types";
import { FIRST_FINISH_YEAR, finishedAtFor, isPastFinish, type EntryStatus, type FinishWhen } from "@/core/collection/entries";
import { shelfOfKind } from "@/core/collection/view";
import { localDateKey } from "@/core/stats/period";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useOnline } from "../offline/outbox";
import { rememberTitles, useRecentTitles } from "../offline/recent-titles";
import { Sheet } from "../sheet";
import { MIN_SEARCH_CHARS, PosterButton, SearchStatus, useTitleSearch } from "../title-search";
import { useSearchBadges, useWarningLabel } from "../warnings/warning-badge";
import { TitleDetails } from "./title-details";

/** Calls back with an added title. `past`: a finish from before yesterday, pasted in quietly (ADR 0096). */
export type QuickAddHandler = (result: SearchResult, status: EntryStatus, finishedAt: string | null, past: boolean) => void;

/**
 * The ➕ sheet (S1 collection): search → tap a result → tap a status. Three taps from the ➕ to a
 * finished title; the finish is today unless another day is picked first: yesterday, a day, or only the year for
 * one from years ago (ADR 0096). A switcher narrows the search to movies & TV,
 * books or manga (S2 books & manga), or games (S3 games); All searches every catalog. Offline, titles seen lately on this device stand in
 * for the search (S3 offline). The status step shows a picked title's warning note and, on request, its details and
 * content warnings (stage 4, ADR 0058). A finish from before yesterday is filling in the past: it's pasted in without
 * the celebration and the sheet goes back to the search for the next one, counting them (ADR 0096).
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
  onAdd: QuickAddHandler;
  timeZone: string;
  /** Start on this title's status step instead of the search. */
  initialPick?: SearchResult | null;
}) {
  const t = useTranslations("Collection");
  return (
    <Sheet open={open} onClose={onClose} title={t("add")} closeLabel={t("close")}>
      <QuickAddSteps onAdd={onAdd} onDone={onClose} timeZone={timeZone} initialPick={initialPick} />
    </Sheet>
  );
}

function QuickAddSteps({
  onAdd,
  onDone,
  timeZone,
  initialPick,
}: {
  onAdd: QuickAddHandler;
  onDone: () => void;
  timeZone: string;
  initialPick: SearchResult | null;
}) {
  const t = useTranslations("Collection");
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SearchType>("all");
  const search = useTitleSearch(query, type);
  const [picked, setPicked] = useState<SearchResult | null>(initialPick);
  // When the finish was: kept from one title to the next, so filling in the past is a tap per title.
  const [when, setWhen] = useState<FinishWhen>({ on: "today" });
  // Titles from the past pasted in since the sheet opened (ADR 0096).
  const [pasted, setPasted] = useState<SearchResult[]>([]);
  // S2 content warnings: badges on results with a Yes for one of the user's avoid-topics.
  const badges = useSearchBadges(search.status === "done" ? search.results : null);
  const warningLabel = useWarningLabel();
  const online = useOnline();

  // A picked title is remembered for adding offline later.
  const pick = (result: SearchResult) => {
    rememberTitles([result]);
    setPicked(result);
  };

  function add(result: SearchResult, status: EntryStatus, finishedAt: string | null) {
    const past = status === "finished" && isPastFinish(when, timeZone);
    onAdd(result, status, finishedAt, past);
    if (!past) return;
    // Back to an empty search for the next one.
    setPasted((cur) => [result, ...cur.filter((r) => r.kind !== result.kind || r.externalId !== result.externalId)]);
    setPicked(null);
    setQuery("");
  }

  if (picked) {
    return (
      <PickStatus
        result={picked}
        warning={warningLabel(badges[`${picked.kind}:${picked.externalId}`])}
        when={when}
        onWhen={setWhen}
        onBack={() => setPicked(null)}
        onAdd={add}
        timeZone={timeZone}
      />
    );
  }
  const strip = pasted.length > 0 && <PastedStrip pasted={pasted} onDone={onDone} />;
  if (!online)
    return (
      <div className="flex flex-col gap-4">
        {strip}
        <OfflinePicks onPick={pick} />
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      {strip}
      <div role="group" aria-label={t("searchTypes")} className="-mx-1 flex gap-1 overflow-x-auto px-1 py-0.5">
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
        <ul className="stagger grid grid-cols-3 gap-3">
          {search.results.map((r) => (
            <li key={`${r.source}-${r.kind}-${r.externalId}`}>
              <PosterButton result={r} onPick={pick} warning={warningLabel(badges[`${r.kind}:${r.externalId}`])} />
            </li>
          ))}
        </ul>
      )}
      {query.trim().length < MIN_SEARCH_CHARS && (
        <>
          <p className="text-sm text-muted-foreground">{t("addHint")}</p>
          {/* A long history comes faster from the app it's in (ADR 0041). */}
          <Link href="/settings/import" className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-brand underline-offset-4 hover:underline">
            {t("importLink")}
          </Link>
        </>
      )}
    </div>
  );
}

/** Filling in the past (ADR 0096): the titles pasted in so far, newest first, and Done. */
function PastedStrip({ pasted, onDone }: { pasted: SearchResult[]; onDone: () => void }) {
  const t = useTranslations("Collection");
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-brand-soft/70 py-2 pr-2 pl-3 ring-1 ring-brand/15 dark:bg-brand/15">
      <ul aria-hidden="true" className="flex shrink-0 -space-x-3">
        {pasted.slice(0, 4).map((r, i) => (
          <li
            key={`${r.kind}-${r.externalId}`}
            style={{ zIndex: 4 - i }}
            className={cn(
              "relative w-7 overflow-hidden rounded-[3px] bg-muted shadow-sm ring-2 ring-card",
              r.kind === "game" ? "aspect-square" : "aspect-[2/3]",
              i % 2 ? "rotate-3" : "-rotate-3",
            )}
          >
            {r.imageUrl && <Image src={r.imageUrl} alt="" fill unoptimized sizes="28px" className="object-cover" />}
          </li>
        ))}
      </ul>
      <p role="status" className="min-w-0 flex-1 text-sm leading-snug">
        <span className="block font-bold">{t("pastedCount", { count: pasted.length })}</span>
        <span className="block text-muted-foreground">{t("pastedMore")}</span>
      </p>
      <button type="button" onClick={onDone} className="h-11 shrink-0 rounded-full bg-foreground px-4 text-sm font-bold text-background press">
        {t("pastedDone")}
      </button>
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
          <ul className="stagger grid grid-cols-3 gap-3">
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

const WHEN_OPTIONS = ["today", "yesterday", "day", "year"] as const;

function PickStatus({
  result,
  warning,
  when,
  onWhen,
  onBack,
  onAdd,
  timeZone,
}: {
  result: SearchResult;
  /** The search badge's words, when the cache already flags one of the viewer's avoid-topics. */
  warning: string | null;
  when: FinishWhen;
  onWhen: (when: FinishWhen) => void;
  onBack: () => void;
  onAdd: (r: SearchResult, s: EntryStatus, f: string | null) => void;
  timeZone: string;
}) {
  const t = useTranslations("Collection");
  const home = useTranslations("Home");
  const format = useFormatter();
  const finishedAt = finishedAtFor(when, timeZone);
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

      <TitleDetails key={`${result.kind}-${result.externalId}`} result={result} warning={warning} />

      <div className="flex flex-col gap-3">
        <FinishWhenPicker result={result} when={when} onWhen={onWhen} timeZone={timeZone} />
        <button
          type="button"
          disabled={!finishedAt}
          onClick={() => onAdd(result, "finished", finishedAt)}
          className="h-14 rounded-full bg-brand text-lg font-extrabold tracking-wide text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-50 press"
        >
          {t("finishedWhen", {
            on: when.on,
            date: finishedAt ? format.dateTime(new Date(finishedAt), { dateStyle: "medium", timeZone }) : "",
            year: when.on === "year" ? String(when.year) : "",
          })}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["watching", "want"] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onAdd(result, status, null)}
            className="h-12 rounded-full font-semibold ring-1 ring-border hover:bg-muted press"
          >
            {t("statusLabel", { status, shelf })}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * When the finish was (ADR 0096), above the Finished button so it's seen before the tap: Today, Yesterday, Pick a
 * day (a date field) or Years ago (only the year, dated 1 January as imports are).
 */
function FinishWhenPicker({
  result,
  when,
  onWhen,
  timeZone,
}: {
  result: SearchResult;
  when: FinishWhen;
  onWhen: (when: FinishWhen) => void;
  timeZone: string;
}) {
  const t = useTranslations("Collection");
  const dateId = useId();
  const yearId = useId();
  const [today] = useState(() => localDateKey(Date.now(), timeZone));
  const thisYear = Number(today.slice(0, 4));
  // The date field's picker opens when Pick a day is tapped, not when a title opens on it.
  const openPicker = useRef(false);
  const dateRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (when.on !== "day" || !openPicker.current) return;
    openPicker.current = false;
    try {
      dateRef.current?.showPicker();
    } catch {
      dateRef.current?.focus();
    }
  }, [when.on]);

  function choose(on: (typeof WHEN_OPTIONS)[number]) {
    if (on === when.on) return;
    if (on === "day") {
      openPicker.current = true;
      onWhen({ on, date: today });
    } else if (on === "year") {
      // A first guess: the year it came out.
      const year = result.year && result.year >= FIRST_FINISH_YEAR && result.year <= thisYear ? result.year : thisYear - 1;
      onWhen({ on, year });
    } else onWhen({ on });
  }

  const years = Array.from({ length: thisYear - FIRST_FINISH_YEAR + 1 }, (_, i) => thisYear - i);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{t("whenLegend")}</legend>
      <div className="grid grid-cols-4 gap-1 rounded-full bg-muted p-1">
        {WHEN_OPTIONS.map((on) => (
          <button
            key={on}
            type="button"
            aria-pressed={when.on === on}
            onClick={() => choose(on)}
            className={cn(
              "min-h-10 rounded-full px-1 text-[13px] leading-tight font-semibold transition-colors",
              when.on === on ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("whenOption", { on })}
          </button>
        ))}
      </div>
      {when.on === "day" && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <label htmlFor={dateId}>{t("finishedOn")}</label>
          <input
            ref={dateRef}
            id={dateId}
            type="date"
            value={when.date}
            max={today}
            min="1900-01-01"
            required
            onChange={(e) => onWhen({ on: "day", date: e.target.value })}
            className="h-11 rounded-lg border border-input bg-card px-2 text-foreground"
          />
        </div>
      )}
      {when.on === "year" && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <label htmlFor={yearId}>{t("finishYear")}</label>
            <select
              id={yearId}
              value={when.year}
              onChange={(e) => onWhen({ on: "year", year: Number(e.target.value) })}
              className="h-11 rounded-lg border border-input bg-card px-2 text-foreground"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">{t("yearNote")}</p>
        </div>
      )}
    </fieldset>
  );
}
