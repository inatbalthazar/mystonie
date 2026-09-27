// Reading totals (S2 books & manga): pages, chapters and volumes read, books and manga finished, and the estimated
// reading time. Like `titleWatch` for watching, one function per title feeds the Read tab's header, its rows and the
// stats page, so they agree for the same period (ADR 0029).
import { isReadingKind } from "../catalog/types";
import { finishRemainder, READING_SECONDS, readingAmounts, type ReadingLog, type ReadingUnit } from "../collection/reading";
import type { TimeRange } from "./period";
import type { StatsEntry, StatsTitle } from "./summary";

export type ReadTotals = {
  /** Estimated reading time, minutes. */
  minutes: number;
  pages: number;
  chapters: number;
  volumes: number;
  /** Books and manga finished in the range. */
  finished: number;
};

export type ReadingSummary = ReadTotals & { booksFinished: number; mangaFinished: number };

export type StatsReadingLog = ReadingLog;

/** A dated piece of reading: a log's progress, or a finish (with the rest of the way to the end). */
export type ReadEvent = { at: number; unit: ReadingUnit | null; amount: number; finished: number };

const EMPTY: ReadTotals = { minutes: 0, pages: 0, chapters: 0, volumes: 0, finished: 0 };

/**
 * One title's reading as dated events: each log adds what it moves past the furthest point before it; finishing adds
 * the rest of the way to the end (a book finished without logs counts all its pages on its finish date).
 */
export function readingEvents(title: StatsTitle, entry: StatsEntry | undefined, logs: readonly StatsReadingLog[]): ReadEvent[] {
  if (!isReadingKind(title.kind)) return [];
  const events: ReadEvent[] = readingAmounts(logs).map(({ log, amount }) => ({ at: Date.parse(log.readAt), unit: log.unit, amount, finished: 0 }));
  if (entry && !entry.deletedAt && entry.status === "finished" && entry.finishedAt) {
    const rest = finishRemainder(title, logs);
    events.push({ at: Date.parse(entry.finishedAt), unit: rest?.unit ?? null, amount: rest?.amount ?? 0, finished: 1 });
  }
  return events;
}

/** Adds events up (minutes rounded once, per title, so rows and headers sum the same integers). */
export function sumReadEvents(events: readonly ReadEvent[], range: TimeRange = null): ReadTotals {
  const totals = { ...EMPTY };
  let seconds = 0;
  for (const e of events) {
    if (range && !(e.at >= range.from && e.at < range.to)) continue;
    totals.finished += e.finished;
    if (!e.unit || e.amount === 0) continue;
    seconds += e.amount * READING_SECONDS[e.unit];
    if (e.unit === "page") totals.pages += e.amount;
    else if (e.unit === "chapter") totals.chapters += e.amount;
    else totals.volumes += e.amount;
  }
  totals.minutes = Math.round(seconds / 60);
  return totals;
}

/** What one book or manga adds to the reading totals in `range` (all time without one). Zero for movies and series. */
export function titleRead(
  title: StatsTitle | undefined,
  entry: StatsEntry | undefined,
  logs: readonly StatsReadingLog[],
  range: TimeRange = null,
): ReadTotals {
  if (!title) return { ...EMPTY };
  return sumReadEvents(readingEvents(title, entry, logs), range);
}

/** Reading totals across a collection: the sum of `titleRead` over every book and manga with an entry or a log. */
export function summarizeReading(
  titles: readonly StatsTitle[],
  entries: readonly StatsEntry[],
  readingLogs: readonly StatsReadingLog[],
  range: TimeRange = null,
): ReadingSummary {
  const titleById = new Map(titles.map((t) => [t.id, t]));
  const entryByTitle = new Map(entries.filter((e) => !e.deletedAt).map((e) => [e.titleId, e]));
  const logsByTitle = new Map<string, StatsReadingLog[]>();
  for (const log of readingLogs) {
    const list = logsByTitle.get(log.titleId);
    if (list) list.push(log);
    else logsByTitle.set(log.titleId, [log]);
  }
  const summary: ReadingSummary = { ...EMPTY, booksFinished: 0, mangaFinished: 0 };
  for (const titleId of new Set([...entryByTitle.keys(), ...logsByTitle.keys()])) {
    const title = titleById.get(titleId);
    if (!title || !isReadingKind(title.kind)) continue;
    const read = titleRead(title, entryByTitle.get(titleId), logsByTitle.get(titleId) ?? [], range);
    summary.minutes += read.minutes;
    summary.pages += read.pages;
    summary.chapters += read.chapters;
    summary.volumes += read.volumes;
    summary.finished += read.finished;
    if (read.finished && title.kind === "book") summary.booksFinished += 1;
    if (read.finished && title.kind === "manga") summary.mangaFinished += 1;
  }
  return summary;
}
