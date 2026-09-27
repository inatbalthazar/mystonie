// Collection totals (S1 collection summary header, S1 stats headline numbers, recaps).
// One function feeds every screen, so the numbers agree everywhere for the same period.
// Inputs mirror the database rows (mapped to camelCase in src/data); timestamps are ISO strings.
import type { TitleKind } from "../catalog/types";
import type { EntryStatus } from "../collection/entries";
import { inRange, type TimeRange } from "./period";

export type { EntryStatus };

export type StatsTitle = {
  id: string;
  kind: TitleKind;
  /** Movie runtime, or the typical episode runtime for a series. */
  runtimeMin: number | null;
  episodeCount: number | null;
  /** Books and manga (reading totals, `titleRead`). */
  pageCount?: number | null;
  chapterCount?: number | null;
  volumeCount?: number | null;
};

export type StatsEntry = {
  id: string;
  titleId: string;
  status: EntryStatus;
  finishedAt: string | null;
  deletedAt?: string | null;
};

export type StatsEpisodeLog = {
  id: string;
  titleId: string;
  /** Copied from the episode at log time; the title's typical runtime when unknown. */
  runtimeMin: number | null;
  watchedAt: string;
  deletedAt?: string | null;
};

export type WatchTotals = {
  /** Watched time in minutes. */
  minutes: number;
  episodes: number;
  /** Titles finished in the range. */
  finished: number;
};

export type CollectionSummary = WatchTotals & { moviesFinished: number; seriesFinished: number };

const live = <T extends { deletedAt?: string | null }>(row: T) => !row.deletedAt;

/**
 * What one title adds to the totals. Only finished entries and logged episodes count (S1 collection):
 * - a movie counts its runtime when it was finished in the range;
 * - a book or manga counts as finished, with no watch time (its reading is `titleRead`'s);
 * - a series counts its logged episodes in the range. A series marked finished without any logged
 *   episodes counts all its episodes (runtime × episode count) on its finish date, as its Finish card does.
 * `logs` are this title's episode logs (any range; deleted ones are ignored).
 */
export function titleWatch(
  title: StatsTitle | undefined,
  entry: StatsEntry | undefined,
  logs: readonly StatsEpisodeLog[],
  range: TimeRange = null,
): WatchTotals {
  const finished = !!entry && live(entry) && entry.status === "finished" && inRange(entry.finishedAt, range);
  const runtime = title?.runtimeMin ?? 0;

  if (title?.kind !== "series") {
    const watched = finished && title?.kind === "movie" ? runtime : 0;
    return { minutes: watched, episodes: 0, finished: finished ? 1 : 0 };
  }

  const liveLogs = logs.filter(live);
  if (liveLogs.length === 0 && finished) {
    const episodes = title.episodeCount ?? 0;
    return { minutes: runtime * episodes, episodes, finished: 1 };
  }
  let minutes = 0;
  let episodes = 0;
  for (const log of liveLogs) {
    if (!inRange(log.watchedAt, range)) continue;
    minutes += log.runtimeMin ?? runtime;
    episodes += 1;
  }
  return { minutes, episodes, finished: finished ? 1 : 0 };
}

/**
 * Totals across a collection, optionally for a period (`periodRange`). Soft-deleted rows are ignored.
 * Equals the sum of `titleWatch` over every title that has an entry or an episode log.
 */
export function summarizeCollection(
  titles: readonly StatsTitle[],
  entries: readonly StatsEntry[],
  episodeLogs: readonly StatsEpisodeLog[],
  range: TimeRange = null,
): CollectionSummary {
  const titleById = new Map(titles.map((t) => [t.id, t]));
  const entryByTitle = new Map(entries.filter(live).map((e) => [e.titleId, e]));
  const logsByTitle = new Map<string, StatsEpisodeLog[]>();
  for (const log of episodeLogs) {
    if (!live(log)) continue;
    const list = logsByTitle.get(log.titleId);
    if (list) list.push(log);
    else logsByTitle.set(log.titleId, [log]);
  }

  const summary: CollectionSummary = { minutes: 0, episodes: 0, finished: 0, moviesFinished: 0, seriesFinished: 0 };
  for (const titleId of new Set([...entryByTitle.keys(), ...logsByTitle.keys()])) {
    const title = titleById.get(titleId);
    const watch = titleWatch(title, entryByTitle.get(titleId), logsByTitle.get(titleId) ?? [], range);
    summary.minutes += watch.minutes;
    summary.episodes += watch.episodes;
    summary.finished += watch.finished;
    if (watch.finished && title?.kind === "movie") summary.moviesFinished += 1;
    if (watch.finished && title?.kind === "series") summary.seriesFinished += 1;
  }
  return summary;
}
