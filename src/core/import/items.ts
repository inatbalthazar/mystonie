// What every importer turns an export into (S3 import & export, ADR 0041): one item per title, the query the server
// finds it by, and what the export says about it (status, dates, rating, episodes, reading progress). Letterboxd,
// Goodreads, MyAnimeList, TV Time and Mystonie's own CSV export all end up here, so the preview, the matching and
// the commit are shared.
import type { ImportUnit } from "../cards/types";
import type { TitleKind } from "../catalog/types";
import type { EntryStatus } from "../collection/entries";
import type { ReadingUnit } from "../collection/reading";

export const IMPORT_SOURCES = ["letterboxd", "goodreads", "mal", "tvtime", "mystonie"] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number];
export const isImportSource = (v: unknown): v is ImportSource => (IMPORT_SOURCES as readonly unknown[]).includes(v);

/** How the server finds an item in a catalog. */
export type ItemQuery =
  /** A film by name and year on TMDB (Letterboxd, TV Time movies). */
  | { by: "film"; name: string; year: number | null }
  /** A series by name (and year, when the export has one) on TMDB; TV Time also gives TheTVDB's id. */
  | { by: "show"; name: string; year: number | null; tvdbId: string | null }
  /** A book by ISBN, else title and author, on Google Books (Goodreads). */
  | { by: "book"; name: string; author: string | null; isbn: string | null }
  /** A MyAnimeList id: manga through AniList, anime through AniList's names then TMDB. */
  | { by: "mal"; type: "anime" | "manga"; malId: number; name: string }
  /** A catalog id we already know (Mystonie's own export). */
  | { by: "id"; kind: TitleKind; externalId: string };

/** What "Find it" searches for an item nothing was found for: a kind, or `screen` (a movie or a series). */
export type FindKind = TitleKind | "screen";

export type ImportEpisode = { season: number; episode: number; watchedAt: string };
export type ImportReading = { unit: ReadingUnit; position: number; readAt: string };

export type ImportItem = {
  /** Unique within the import: joins the preview, the matches and the rows. */
  key: string;
  name: string;
  year: number | null;
  /** A book's author: tells namesakes apart in the preview. */
  author: string | null;
  find: FindKind;
  query: ItemQuery;
  status: EntryStatus;
  /** `YYYY-MM-DD` it was finished (in the user's calendar), when the export only has a day. */
  watchedOn: string | null;
  /** The exact time it was finished (UTC ISO), when the export has one (TV Time, Mystonie). Wins over `watchedOn`. */
  finishedAt: string | null;
  /** Finished, but the export doesn't say when (MyAnimeList often doesn't): dated by the title's year on saving. */
  undated: boolean;
  /** 0.5–5 in half steps. */
  rating: number | null;
  review: string | null;
  /** A game's hours played (Mystonie's CSV export, S3 games). */
  hoursPlayed: number | null;
  episodes: ImportEpisode[];
  reading: ImportReading[];
};

/** One export read on the device: the items, and how many were cut over the limit. */
export type ParsedImport = { source: ImportSource; items: ImportItem[]; cut: number };

/** More items than this in one export are cut (the most recent are kept). */
export const IMPORT_MAX_ITEMS = 5000;
/** Most episodes or reading logs one title brings (the latest are kept). */
export const IMPORT_MAX_LOGS_PER_ITEM = 3000;

/** A blank item: every importer fills in what its export has. */
export function importItem(fields: Pick<ImportItem, "key" | "name" | "find" | "query" | "status"> & Partial<ImportItem>): ImportItem {
  return {
    year: null,
    author: null,
    watchedOn: null,
    finishedAt: null,
    undated: false,
    rating: null,
    review: null,
    hoursPlayed: null,
    episodes: [],
    reading: [],
    ...fields,
  };
}

/** When the item was finished, for sorting ("" when it wasn't, or the export doesn't say). */
export const finishedKey = (item: Pick<ImportItem, "finishedAt" | "watchedOn">) => item.finishedAt ?? item.watchedOn ?? "";

/** Latest activity first (finished, then logged), then the rest by name; at most `IMPORT_MAX_ITEMS`. */
export function capItems(items: ImportItem[]): { items: ImportItem[]; cut: number } {
  const recent = (i: ImportItem) =>
    [finishedKey(i), ...i.episodes.map((e) => e.watchedAt), ...i.reading.map((r) => r.readAt)].reduce((a, b) => (b > a ? b : a), "");
  const rank = (s: EntryStatus) => (s === "finished" ? 0 : s === "watching" ? 1 : 2);
  const sorted = [...items].sort(
    (a, b) => rank(a.status) - rank(b.status) || recent(b).localeCompare(recent(a)) || a.name.localeCompare(b.name) || (a.year ?? 0) - (b.year ?? 0),
  );
  return { items: sorted.slice(0, IMPORT_MAX_ITEMS), cut: Math.max(0, sorted.length - IMPORT_MAX_ITEMS) };
}

/** Keeps the latest `IMPORT_MAX_LOGS_PER_ITEM` logs, oldest first. */
export function capLogs<T>(logs: T[], at: (log: T) => string): T[] {
  const sorted = [...logs].sort((a, b) => at(a).localeCompare(at(b)));
  return sorted.slice(Math.max(0, sorted.length - IMPORT_MAX_LOGS_PER_ITEM));
}

/**
 * Several export rows that turned out to be the same title (MyAnimeList lists each anime season on its own, TMDB
 * has one series; a film under two names) → one. Movies and books count as finished when any row is. Series and
 * manga only when every row is (season 1 completed + season 2 watching = still watching), and want when all are.
 * The latest finish date wins, with its rating; episodes and reading logs are joined.
 */
export function mergeItems(items: readonly ImportItem[], kind: TitleKind): ImportItem {
  const [first, ...rest] = items;
  if (!first || rest.length === 0) return first!;
  const statuses = items.map((i) => i.status);
  const status: EntryStatus =
    kind === "movie" || kind === "book"
      ? statuses.includes("finished")
        ? "finished"
        : statuses.includes("watching")
          ? "watching"
          : "want"
      : statuses.every((s) => s === "finished")
        ? "finished"
        : statuses.every((s) => s === "want")
          ? "want"
          : "watching";
  const finished = items.filter((i) => i.status === "finished").sort((a, b) => finishedKey(b).localeCompare(finishedKey(a)));
  const latest = finished[0];
  const episodes = new Map<string, ImportEpisode>();
  for (const e of items.flatMap((i) => i.episodes)) {
    const k = `${e.season}:${e.episode}`;
    const had = episodes.get(k);
    if (!had || e.watchedAt > had.watchedAt) episodes.set(k, e);
  }
  const reading = new Map<string, ImportReading>();
  for (const r of items.flatMap((i) => i.reading)) {
    const k = `${r.unit}:${r.position}`;
    const had = reading.get(k);
    if (!had || r.readAt > had.readAt) reading.set(k, r);
  }
  const done = status === "finished" && latest;
  return {
    ...first,
    status,
    watchedOn: done ? latest.watchedOn : null,
    finishedAt: done ? latest.finishedAt : null,
    undated: done ? latest.undated : false,
    rating: (done ? latest.rating : null) ?? items.find((i) => i.rating !== null)?.rating ?? null,
    review: items.find((i) => i.review)?.review ?? null,
    episodes: [...episodes.values()],
    reading: [...reading.values()],
  };
}

/** The rating scale most sites use (1–10, MyAnimeList) → Mystonie's 0.5–5 in half steps. 0 = unrated. */
export function ratingFromTen(score: number): number | null {
  return Number.isInteger(score) && score >= 1 && score <= 10 ? score / 2 : null;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date `YYYY-MM-DD` from 1900 on, else null. `YYYY/MM/DD` (Goodreads) is accepted too. */
export function dateOf(value: string | undefined): string | null {
  const v = value?.trim().replace(/\//g, "-");
  const match = v ? DATE_RE.exec(v) : null;
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? v! : null;
}

/**
 * A moment as UTC ISO: `2021-03-04 21:14:33` (TV Time, UTC) or any ISO string with a zone. Null when it isn't one,
 * or is before 1900.
 */
export function momentOf(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const zoned = /[zZ]|[+-]\d{2}:?\d{2}$/.test(v.slice(10));
  const t = Date.parse(zoned ? v.replace(" ", "T") : `${v.replace(" ", "T")}${v.length > 10 ? "Z" : "T00:00:00Z"}`);
  return Number.isNaN(t) || t < Date.UTC(1900, 0, 1) ? null : new Date(t).toISOString();
}

export function yearOf(v: string | undefined): number | null {
  const year = v && /^\d{4}$/.test(v.trim()) ? Number(v) : NaN;
  return year >= 1870 && year <= 2200 ? year : null;
}

/** A name as the export spells it, tidied; null when empty or absurdly long. */
export function nameOf(v: string | undefined): string | null {
  const name = v?.replace(/\s+/g, " ").trim();
  return name && name.length <= 300 ? name : null;
}

/** "Doctor Who (2005)" → the name and the year TheTVDB and others add to tell namesakes apart. */
export function splitYear(name: string): { name: string; year: number | null } {
  const match = /^(.*\S)\s+\((\d{4})\)$/.exec(name);
  return match ? { name: match[1]!, year: yearOf(match[2]) } : { name, year: null };
}

/** The noun a set of items is counted in ("312 films", "48 books", "20 titles" when mixed). */
export function importUnit(kinds: readonly (FindKind | TitleKind)[]): ImportUnit {
  const set = new Set(kinds);
  if (set.size !== 1) return "title";
  const [only] = set;
  return only === "movie" ? "film" : only === "series" || only === "book" || only === "manga" || only === "game" ? only : "title";
}
