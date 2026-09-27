// The collection page (S1 collection → Collection view): year/status filters, sort, per-row numbers and
// the summary header. The header is always the sum of the visible rows (both come from `titleWatch`).
import { localDate, safeTimeZone, startOfLocalDay, type TimeRange } from "../stats/period";
import { titleWatch, type StatsEpisodeLog, type WatchTotals } from "../stats/summary";
import { sortCollection, titleKey, type CollectionItem, type EntryStatus } from "./entries";

export const COLLECTION_SORTS = ["finished", "title", "runtime"] as const;
export type CollectionSort = (typeof COLLECTION_SORTS)[number];

export const COLLECTION_LAYOUTS = ["list", "tiles"] as const;
export type CollectionLayout = (typeof COLLECTION_LAYOUTS)[number];

export type CollectionFilter = {
  /** A calendar year in the user's time zone; null = all time. */
  year: number | null;
  status: EntryStatus | null;
};

/** An episode log as the collection needs it (`titleId` is the `titles` row id). */
export type WatchLog = Pick<StatsEpisodeLog, "id" | "titleId" | "runtimeMin" | "watchedAt">;

export type CollectionRow<T extends CollectionItem = CollectionItem> = {
  item: T;
  /** What this title adds to the header for the filter's year (all time without one). */
  watch: WatchTotals;
  /** Logged episodes of a series, all time (the "12 / 42" progress). */
  episodesLogged: number;
  /** Shown length: a movie's runtime, a series' watched time for the filter's year. */
  lengthMin: number | null;
};

/** 1 Jan of `year` to 1 Jan of the next year, local midnights in `timeZone`. */
export function yearRange(year: number, timeZone: string): TimeRange {
  const zone = safeTimeZone(timeZone);
  return { from: startOfLocalDay(year, 1, 1, zone), to: startOfLocalDay(year + 1, 1, 1, zone) };
}

function logsByTitle(logs: readonly WatchLog[]): Map<string, WatchLog[]> {
  const map = new Map<string, WatchLog[]>();
  for (const log of logs) {
    const list = map.get(log.titleId);
    if (list) list.push(log);
    else map.set(log.titleId, [log]);
  }
  return map;
}

/** Years (newest first) with a finish or an episode log of a title in the collection: the year filter's options. */
export function collectionYears(items: readonly CollectionItem[], logs: readonly WatchLog[], timeZone: string): number[] {
  const inCollection = new Set(items.flatMap((i) => (i.title.id ? [i.title.id] : [])));
  const stamps = [
    ...items.flatMap((i) => (i.finishedAt ? [i.finishedAt] : [])),
    ...logs.filter((l) => inCollection.has(l.titleId)).map((l) => l.watchedAt),
  ];
  const zone = safeTimeZone(timeZone);
  const years = new Set(stamps.map(Date.parse).filter(Number.isFinite).map((t) => localDate(t, zone).year));
  return [...years].sort((a, b) => b - a);
}

/**
 * The rows the page shows. A status filter keeps entries with that status; a year keeps titles finished
 * or with an episode logged that year, and scopes each row's numbers to it.
 */
export function collectionRows<T extends CollectionItem>(
  items: readonly T[],
  logs: readonly WatchLog[],
  filter: CollectionFilter,
  timeZone: string,
): CollectionRow<T>[] {
  const range = filter.year === null ? null : yearRange(filter.year, timeZone);
  const byTitle = logsByTitle(logs);
  const rows: CollectionRow<T>[] = [];
  for (const item of items) {
    if (filter.status && item.status !== filter.status) continue;
    const { title } = item;
    const titleLogs = (title.id && byTitle.get(title.id)) || [];
    const id = title.id ?? titleKey(title);
    const watch = titleWatch(
      { id, kind: title.kind, runtimeMin: title.runtimeMin ?? null, episodeCount: title.episodeCount ?? null },
      { id: item.id, titleId: id, status: item.status, finishedAt: item.finishedAt },
      titleLogs,
      range,
    );
    if (range && watch.finished === 0 && watch.episodes === 0) continue;
    rows.push({
      item,
      watch,
      episodesLogged: titleLogs.length,
      lengthMin: title.kind === "movie" ? (title.runtimeMin ?? null) : watch.minutes,
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
