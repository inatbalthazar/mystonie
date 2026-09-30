// Reading progress (S2 books & manga, ADR 0029): a book is logged by page, a manga by chapter or volume. Each log is a
// checkpoint ("I'm at chapter 1100"), not one row per chapter, so catching up on a long manga is one tap. What a log
// adds is how far it moves past the furthest point logged before it.
import type { ReadingKind, TitleKind } from "../catalog/types";
import { isExternalId } from "../catalog/types";
import { isUuidV7 } from "../ids";
import { actionTime } from "./entries";

export const READING_UNITS = ["page", "chapter", "volume"] as const;
export type ReadingUnit = (typeof READING_UNITS)[number];

export const isReadingUnit = (v: unknown): v is ReadingUnit => (READING_UNITS as readonly unknown[]).includes(v);

/** The units a kind is logged in, the usual one first. */
export function unitsFor(kind: ReadingKind): ReadingUnit[] {
  return kind === "book" ? ["page"] : ["chapter", "volume"];
}

/**
 * Estimated reading time per unit, in seconds: a page of a book 1.5 min (about 300 words at 200–250 wpm), a manga
 * chapter 5 min (about 20 pages of panels), a volume 45 min (about 9 chapters). Estimates, labelled as such in the UI.
 */
export const READING_SECONDS: Record<ReadingUnit, number> = { page: 90, chapter: 300, volume: 2700 };

/** The highest position a request may log (a very long manga or book). */
export const MAX_READING_POSITION = 100_000;

export type ReadingLog = {
  id: string;
  titleId: string;
  unit: ReadingUnit;
  /** The page, chapter or volume reached. */
  position: number;
  readAt: string;
  deletedAt?: string | null;
};

/** What a title has in each unit (null = unknown, e.g. a running manga). */
export type ReadingLengths = {
  kind: TitleKind;
  pageCount?: number | null;
  chapterCount?: number | null;
  volumeCount?: number | null;
};

export function unitTotal(title: ReadingLengths, unit: ReadingUnit): number | null {
  const total = unit === "page" ? title.pageCount : unit === "chapter" ? title.chapterCount : title.volumeCount;
  return total && total > 0 ? total : null;
}

const live = <T extends { deletedAt?: string | null }>(row: T) => !row.deletedAt;
const byTime = (a: ReadingLog, b: ReadingLog) => Date.parse(a.readAt) - Date.parse(b.readAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** The furthest point logged in `unit` (0 when nothing is). Deleted logs don't count. */
export function readingPosition(logs: readonly Pick<ReadingLog, "unit" | "position" | "deletedAt">[], unit: ReadingUnit): number {
  let max = 0;
  for (const log of logs) if (live(log) && log.unit === unit && log.position > max) max = log.position;
  return max;
}

/**
 * Each live log of one title with what it adds: its position minus the furthest one logged before it (in time),
 * never below 0. Going back (a re-read, a typo fixed later) adds nothing. The first log counts from the start.
 */
export function readingAmounts<T extends ReadingLog>(logs: readonly T[]): { log: T; amount: number }[] {
  const furthest: Record<ReadingUnit, number> = { page: 0, chapter: 0, volume: 0 };
  return logs
    .filter(live)
    .sort(byTime)
    .map((log) => {
      const amount = Math.max(0, log.position - furthest[log.unit]);
      furthest[log.unit] = Math.max(furthest[log.unit], log.position);
      return { log, amount };
    });
}

/**
 * What finishing adds: the rest of the way to the end, in the unit the title is logged in. A book counts its pages; a
 * manga its chapters (volumes when only volumes were logged, or the chapter count is unknown). Nothing when the length
 * is unknown or already reached.
 */
export function finishRemainder(title: ReadingLengths, logs: readonly ReadingLog[]): { unit: ReadingUnit; amount: number } | null {
  let unit: ReadingUnit;
  if (title.kind === "book") unit = "page";
  else {
    const chapters = readingPosition(logs, "chapter") > 0;
    const volumes = readingPosition(logs, "volume") > 0;
    unit = !chapters && (volumes || !unitTotal(title, "chapter")) ? "volume" : "chapter";
  }
  const total = unitTotal(title, unit);
  if (!total) return null;
  const amount = total - readingPosition(logs, unit);
  return amount > 0 ? { unit, amount } : null;
}

export type ReadingLogRequest = {
  id: string;
  kind: ReadingKind;
  externalId: string;
  unit: ReadingUnit;
  position: number;
  /** When it was read, by the device's clock (a log made offline arrives later, ADR 0042). */
  readAt: string;
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * POST /api/reading body: `{ id, kind, externalId, unit, position, readAt? }` (a v7 id; the unit must suit the kind;
 * `readAt` defaults to now).
 */
export function parseReadingLog(body: unknown, now: number = Date.now()): ReadingLogRequest | null {
  if (!isObject(body)) return null;
  const { id, kind, externalId, unit, position } = body;
  if (typeof id !== "string" || !isUuidV7(id) || (kind !== "book" && kind !== "manga")) return null;
  if (!isExternalId(kind, externalId) || !isReadingUnit(unit) || !unitsFor(kind).includes(unit)) return null;
  if (typeof position !== "number" || !Number.isInteger(position) || position < 1 || position > MAX_READING_POSITION) return null;
  const readAt = actionTime(body.readAt, now);
  if (!readAt) return null;
  return { id, kind, externalId, unit, position, readAt };
}
