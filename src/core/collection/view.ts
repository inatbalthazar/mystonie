// The collection page (S1 collection → Collection view): the Watch, Read (S2 books & manga) and Play (S3 games) tabs,
// year/status filters, sort, per-row numbers and the summary header. The header is always the sum of the visible rows
// (both come from `titleWatch`, `titleRead` on the Read tab or `titlePlay` on the Play tab).
import { isReadingKind, type TitleKind } from "../catalog/types";
import { localDate, safeTimeZone, startOfLocalDay, type TimeRange } from "../stats/period";
import { titlePlay, type PlayTotals } from "../stats/play";
import { titleRead, type ReadTotals, type StatsReadingLog } from "../stats/reading";
import { titleWatch, type StatsEpisodeLog, type WatchTotals } from "../stats/summary";
import { sortCollection, titleKey, type CollectionItem, type EntryStatus } from "./entries";
import { readingPosition } from "./reading";

export const COLLECTION_SORTS = ["finished", "title", "runtime"] as const;
export type CollectionSort = (typeof COLLECTION_SORTS)[number];

export const COLLECTION_LAYOUTS = ["list", "tiles"] as const;
export type CollectionLayout = (typeof COLLECTION_LAYOUTS)[number];

/** Watch = movies and series, Read = books and manga, Play = games. */
export const COLLECTION_SHELVES = ["watch", "read", "play"] as const;
export type CollectionShelf = (typeof COLLECTION_SHELVES)[number];

export const shelfOfKind = (kind: TitleKind): CollectionShelf => (isReadingKind(kind) ? "read" : kind === "game" ? "play" : "watch");
export const shelfOf = (item: { title: { kind: TitleKind } }): CollectionShelf => shelfOfKind(item.title.kind);

export type CollectionFilter = {
  /** A calendar year in the user's time zone; null = all time. */
  year: number | null;
  status: EntryStatus | null;
  /** The tab; undefined = everything. */
  shelf?: CollectionShelf;
};

/** An episode log as the collection needs it (`titleId` is the `titles` row id). */
export type WatchLog = Pick<StatsEpisodeLog, "id" | "titleId" | "runtimeMin" | "watchedAt">;

/** A reading checkpoint as the collection needs it. */
export type ReadLog = Pick<StatsReadingLog, "id" | "titleId" | "unit" | "position" | "readAt">;

export type CollectionRow<T extends CollectionItem = CollectionItem> = {
  item: T;
  /** What this title adds to the header for the filter's year (all time without one). */
  watch: WatchTotals;
  /** What a book or manga adds to the Read tab's header for the filter's year (zeros for everything else). */
  read: ReadTotals;
  /** What a game adds to the Play tab's header for the filter's year (zeros for everything else). */
  play: PlayTotals;
  /** Logged episodes of a series, all time (the "12 / 42" progress). */
  episodesLogged: number;
  /** How far a book or manga is, all time: the furthest page, chapter and volume logged. */
  reached: { page: number; chapter: number; volume: number };
  /**
   * Shown length: a movie's runtime, a series' watched time, a book's or manga's reading time for the filter's year, or
   * a game's hours (the player's own, else RAWG's average).
   */
  lengthMin: number | null;
};

/** 1 Jan of `year` to 1 Jan of the next year, local midnights in `timeZone`. */
export function yearRange(year: number, timeZone: string): TimeRange {
  const zone = safeTimeZone(timeZone);
  return { from: startOfLocalDay(year, 1, 1, zone), to: startOfLocalDay(year + 1, 1, 1, zone) };
}

function logsByTitle<T extends { titleId: string }>(logs: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const log of logs) {
    const list = map.get(log.titleId);
    if (list) list.push(log);
    else map.set(log.titleId, [log]);
  }
  return map;
}

/** Years (newest first) with a finish, an episode log or a reading log of a title in the collection: the year filter's options. */
export function collectionYears(
  items: readonly CollectionItem[],
  logs: readonly WatchLog[],
  timeZone: string,
  readLogs: readonly ReadLog[] = [],
): number[] {
  const inCollection = new Set(items.flatMap((i) => (i.title.id ? [i.title.id] : [])));
  const stamps = [
    ...items.flatMap((i) => (i.finishedAt ? [i.finishedAt] : [])),
    ...logs.filter((l) => inCollection.has(l.titleId)).map((l) => l.watchedAt),
    ...readLogs.filter((l) => inCollection.has(l.titleId)).map((l) => l.readAt),
  ];
  const zone = safeTimeZone(timeZone);
  const years = new Set(stamps.map(Date.parse).filter(Number.isFinite).map((t) => localDate(t, zone).year));
  return [...years].sort((a, b) => b - a);
}

/**
 * The rows the page shows. A shelf keeps its kinds; a status filter keeps entries with that status; a year keeps
 * titles finished, with an episode logged or read further that year, and scopes each row's numbers to it.
 */
export function collectionRows<T extends CollectionItem>(
  items: readonly T[],
  logs: readonly WatchLog[],
  filter: CollectionFilter,
  timeZone: string,
  readLogs: readonly ReadLog[] = [],
): CollectionRow<T>[] {
  const range = filter.year === null ? null : yearRange(filter.year, timeZone);
  const byTitle = logsByTitle(logs);
  const readByTitle = logsByTitle(readLogs);
  const rows: CollectionRow<T>[] = [];
  for (const item of items) {
    if (filter.status && item.status !== filter.status) continue;
    if (filter.shelf && shelfOf(item) !== filter.shelf) continue;
    const { title } = item;
    const titleLogs = (title.id && byTitle.get(title.id)) || [];
    const titleReads = (title.id && readByTitle.get(title.id)) || [];
    const id = title.id ?? titleKey(title);
    const stats = {
      id,
      kind: title.kind,
      runtimeMin: title.runtimeMin ?? null,
      episodeCount: title.episodeCount ?? null,
      pageCount: title.pageCount ?? null,
      chapterCount: title.chapterCount ?? null,
      volumeCount: title.volumeCount ?? null,
      playtimeHours: title.playtimeHours ?? null,
    };
    const entry = { id: item.id, titleId: id, status: item.status, finishedAt: item.finishedAt, hoursPlayed: item.hoursPlayed ?? null };
    const watch = titleWatch(stats, entry, titleLogs, range);
    const read = titleRead(stats, entry, titleReads, range);
    const play = titlePlay(stats, entry, range);
    const hours = item.hoursPlayed ?? title.playtimeHours ?? null;
    if (range && watch.finished === 0 && watch.episodes === 0 && read.pages + read.chapters + read.volumes === 0) continue;
    rows.push({
      item,
      watch,
      read,
      play,
      episodesLogged: titleLogs.length,
      reached: {
        page: readingPosition(titleReads, "page"),
        chapter: readingPosition(titleReads, "chapter"),
        volume: readingPosition(titleReads, "volume"),
      },
      lengthMin:
        title.kind === "movie"
          ? (title.runtimeMin ?? null)
          : isReadingKind(title.kind)
            ? read.minutes
            : title.kind === "game"
              ? hours && hours * 60
              : watch.minutes,
    });
  }
  return rows;
}

/** The summary header: the sum of the rows. */
export function summarizeRows(rows: readonly CollectionRow[]): WatchTotals {
  return rows.reduce(
    (sum, { watch }) => ({
      minutes: sum.minutes + watch.minutes,
      episodes: sum.episodes + watch.episodes,
      finished: sum.finished + watch.finished,
    }),
    { minutes: 0, episodes: 0, finished: 0 },
  );
}

/** The Play tab's header: the sum of the rows' play. */
export function summarizePlayRows(rows: readonly CollectionRow[]): PlayTotals {
  return rows.reduce((sum, { play }) => ({ minutes: sum.minutes + play.minutes, finished: sum.finished + play.finished }), { minutes: 0, finished: 0 });
}

/** The Read tab's header: the sum of the rows' reading. */
export function summarizeReadRows(rows: readonly CollectionRow[]): ReadTotals {
  return rows.reduce(
    (sum, { read }) => ({
      minutes: sum.minutes + read.minutes,
      pages: sum.pages + read.pages,
      chapters: sum.chapters + read.chapters,
      volumes: sum.volumes + read.volumes,
      finished: sum.finished + read.finished,
    }),
    { minutes: 0, pages: 0, chapters: 0, volumes: 0, finished: 0 },
  );
}

/**
 * Sorted rows: `finished` = newest finish (or add) first; `title` = A–Z in the user's language;
 * `runtime` = longest shown length first. Ties keep the finish order.
 */
export function sortRows<R extends CollectionRow>(rows: readonly R[], sort: CollectionSort, locale: string): R[] {
  const order = new Map(sortCollection(rows.map((r) => r.item)).map((item, i) => [item.id, i]));
  const byFinish = (a: R, b: R) => order.get(a.item.id)! - order.get(b.item.id)!;
  if (sort === "finished") return [...rows].sort(byFinish);
  if (sort === "title") {
    const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
    return [...rows].sort((a, b) => collator.compare(a.item.title.name, b.item.title.name) || byFinish(a, b));
  }
  return [...rows].sort((a, b) => (b.lengthMin ?? -1) - (a.lengthMin ?? -1) || byFinish(a, b));
}

export const isCollectionSort = (v: unknown): v is CollectionSort => (COLLECTION_SORTS as readonly unknown[]).includes(v);
export const isCollectionLayout = (v: unknown): v is CollectionLayout => (COLLECTION_LAYOUTS as readonly unknown[]).includes(v);
export const isCollectionShelf = (v: unknown): v is CollectionShelf => (COLLECTION_SHELVES as readonly unknown[]).includes(v);
