// The import's server side, as pure rules (S2 Letterboxd import, ADR 0033; S3 import & export, ADR 0041): request
// bodies, what re-importing does to a title already in the collection, how rows are batched, and the "Imported N
// films" card.
import { RECAP_COLLAGE_MAX, type CardRecap } from "../cards/types";
import { isExternalId, isTitleKind, type TitleKind } from "../catalog/types";
import { finishedAtForDate, isEntryStatus, isHoursPlayed, type EntryStatus } from "../collection/entries";
import { isReadingUnit, MAX_READING_POSITION, unitsFor } from "../collection/reading";
import { isUuidV7 } from "../ids";
import { importUnit, IMPORT_MAX_LOGS_PER_ITEM, type ImportEpisode, type ImportReading, type ItemQuery } from "./items";

/** Items per match request: a few seconds of catalog calls, well inside a function's time. */
export const MATCH_BATCH = 20;
/** Rows per commit request, and within them, series (each may fetch every season) and episode or reading logs. */
export const COMMIT_BATCH = 25;
export const COMMIT_MAX_SERIES = 5;
export const COMMIT_MAX_LOGS = IMPORT_MAX_LOGS_PER_ITEM;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function name(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const n = v.replace(/\s+/g, " ").trim();
  return n && n.length <= 300 ? n : null;
}
const year = (v: unknown) => v === null || (typeof v === "number" && Number.isInteger(v) && v >= 1870 && v <= 2200);

function query(q: unknown): ItemQuery | null {
  if (!isObject(q)) return null;
  switch (q.by) {
    case "film":
    case "show": {
      const n = name(q.name);
      if (!n || !year(q.year)) return null;
      if (q.by === "film") return { by: "film", name: n, year: q.year as number | null };
      if (q.tvdbId !== null && !(typeof q.tvdbId === "string" && /^\d{1,10}$/.test(q.tvdbId))) return null;
      return { by: "show", name: n, year: q.year as number | null, tvdbId: q.tvdbId };
    }
    case "book": {
      const n = name(q.name);
      const author = q.author === null ? null : name(q.author);
      if (!n || (q.author !== null && !author)) return null;
      if (q.isbn !== null && !(typeof q.isbn === "string" && (/^\d{9}[\dX]$/.test(q.isbn) || /^97[89]\d{10}$/.test(q.isbn)))) return null;
      return { by: "book", name: n, author, isbn: q.isbn };
    }
    case "mal": {
      const n = name(q.name);
      if (!n || (q.type !== "anime" && q.type !== "manga")) return null;
      if (typeof q.malId !== "number" || !Number.isInteger(q.malId) || q.malId < 1 || q.malId > 10_000_000) return null;
      return { by: "mal", type: q.type, malId: q.malId, name: n };
    }
    case "id":
      return isTitleKind(q.kind) && isExternalId(q.kind, q.externalId) ? { by: "id", kind: q.kind, externalId: q.externalId } : null;
    default:
      return null;
  }
}

/** POST /api/import/match `{ items: ItemQuery[] }` (≤ 20) → the queries, or null when anything is off. */
export function parseMatchBody(body: unknown): ItemQuery[] | null {
  if (!isObject(body) || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > MATCH_BATCH) return null;
  const items: ItemQuery[] = [];
  for (const q of body.items) {
    const parsed = query(q);
    if (!parsed) return null;
    items.push(parsed);
  }
  return items;
}

/** One title to save: the catalog title it matched, and what the export says about it. `id` is the new entry's. */
export type ImportRow = {
  id: string;
  kind: TitleKind;
  externalId: string;
  status: EntryStatus;
  /** `YYYY-MM-DD` in the user's calendar, when the export has only a day. */
  watchedOn: string | null;
  /** The exact finish time (UTC ISO), when the export has one. */
  finishedAt: string | null;
  /** Finished, but the export doesn't say when: dated by the title's year. */
  undated: boolean;
  rating: number | null;
  review: string | null;
  /** A game's hours played (absent: none). */
  hoursPlayed?: number | null;
  /** A series' episodes seen (with when). */
  episodes: ImportEpisode[];
  /** A book's or manga's reading checkpoints. */
  reading: ImportReading[];
};

/** Logs from after `now` (a clock off, a bad row) don't count: a day's slack, then they're dropped. */
const moment = (v: unknown, now: number): string | null => {
  if (typeof v !== "string" || v.length > 40) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) || t < Date.UTC(1900, 0, 1) || t > now + 86_400_000 ? null : new Date(Math.min(t, now)).toISOString();
};
const small = (v: unknown, min: number) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= 32767;

function row(r: unknown, now: number): ImportRow | null {
  if (!isObject(r)) return null;
  const { id, kind, externalId, status, watchedOn, finishedAt, undated, rating, review } = r;
  const hoursPlayed = r.hoursPlayed ?? null;
  if (typeof id !== "string" || !isUuidV7(id) || !isTitleKind(kind) || !isExternalId(kind, externalId) || !isEntryStatus(status)) return null;
  const finished = status === "finished";
  const day = watchedOn === null ? null : typeof watchedOn === "string" && DATE_RE.test(watchedOn) ? watchedOn : undefined;
  const at = finishedAt === null ? null : (moment(finishedAt, now) ?? undefined);
  if (day === undefined || at === undefined || typeof undated !== "boolean") return null;
  // A finished row says when (a day, a moment, or that it can't); any other row says nothing about finishing.
  if (finished ? day === null && at === null && !undated : day !== null || at !== null || undated) return null;
  if (rating !== null && !(typeof rating === "number" && rating >= 0.5 && rating <= 5 && Number.isInteger(rating * 2))) return null;
  if (review !== null && !(typeof review === "string" && review.trim().length >= 1 && review.length <= 280)) return null;
  if (hoursPlayed !== null && !(kind === "game" && isHoursPlayed(hoursPlayed))) return null;
  if (!Array.isArray(r.episodes) || !Array.isArray(r.reading)) return null;
  if (r.episodes.length > COMMIT_MAX_LOGS || r.reading.length > COMMIT_MAX_LOGS) return null;
  if ((r.episodes.length > 0 && kind !== "series") || (r.reading.length > 0 && kind !== "book" && kind !== "manga")) return null;

  const episodes = new Map<string, ImportEpisode>();
  for (const e of r.episodes) {
    if (!isObject(e) || !small(e.season, 1) || !small(e.episode, 0)) return null;
    const watchedAt = moment(e.watchedAt, now);
    if (!watchedAt) continue;
    episodes.set(`${e.season}:${e.episode}`, { season: e.season as number, episode: e.episode as number, watchedAt });
  }
  const reading = new Map<string, ImportReading>();
  for (const l of r.reading) {
    if (!isObject(l) || !isReadingUnit(l.unit) || !unitsFor(kind as "book" | "manga").includes(l.unit)) return null;
    if (typeof l.position !== "number" || !Number.isInteger(l.position) || l.position < 1 || l.position > MAX_READING_POSITION) return null;
    const readAt = moment(l.readAt, now);
    if (!readAt) continue;
    reading.set(`${l.unit}:${l.position}`, { unit: l.unit, position: l.position, readAt });
  }
  return {
    id,
    kind,
    externalId,
    status,
    watchedOn: day,
    finishedAt: at,
    undated: undated as boolean,
    rating: rating as number | null,
    review: review === null ? null : (review as string).trim(),
    ...(hoursPlayed === null ? {} : { hoursPlayed: hoursPlayed as number }),
    episodes: [...episodes.values()],
    reading: [...reading.values()],
  };
}

/**
 * POST /api/import/commit `{ rows, done? }` → the rows, or null when anything is off. `done` marks the last request
 * of an import. A batch is at most 25 rows, 5 of them series with episodes, and 3,000 logs (see `commitBatches`).
 */
export function parseCommitBody(body: unknown, now: number): { rows: ImportRow[]; done: boolean } | null {
  if (!isObject(body) || !Array.isArray(body.rows) || body.rows.length > COMMIT_BATCH) return null;
  if (body.done !== undefined && typeof body.done !== "boolean") return null;
  const rows: ImportRow[] = [];
  const ids = new Set<string>();
  const titles = new Set<string>();
  for (const raw of body.rows) {
    const r = row(raw, now);
    // One row per title and id: the same title twice in a batch is a client bug.
    if (!r || ids.has(r.id) || titles.has(`${r.kind}:${r.externalId}`)) return null;
    ids.add(r.id);
    titles.add(`${r.kind}:${r.externalId}`);
    rows.push(r);
  }
  if (rows.filter((r) => r.episodes.length > 0).length > COMMIT_MAX_SERIES) return null;
  if (rows.reduce((n, r) => n + r.episodes.length + r.reading.length, 0) > COMMIT_MAX_LOGS) return null;
  if (rows.length === 0 && body.done !== true) return null;
  return { rows, done: body.done === true };
}

/** The rows in commit-sized batches, in order: ≤ 25 rows, ≤ 5 series with episodes, ≤ 3,000 logs each. */
export function commitBatches<T extends Pick<ImportRow, "episodes" | "reading">>(rows: readonly T[]): T[][] {
  const batches: T[][] = [];
  let batch: T[] = [];
  let series = 0;
  let logs = 0;
  for (const r of rows) {
    const n = r.episodes.length + r.reading.length;
    const s = r.episodes.length > 0 ? 1 : 0;
    if (batch.length > 0 && (batch.length === COMMIT_BATCH || series + s > COMMIT_MAX_SERIES || logs + n > COMMIT_MAX_LOGS)) {
      batches.push(batch);
      batch = [];
      series = 0;
      logs = 0;
    }
    batch.push(r);
    series += s;
    logs += n;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

/**
 * `finished_at` for an imported day: noon that day in the user's time zone (now when it's today, and a date ahead
 * of the user's calendar counts as today).
 */
export function importedFinishedAt(watchedOn: string, timeZone: string, now: number): string | null {
  return finishedAtForDate(watchedOn, timeZone, now) ?? (DATE_RE.test(watchedOn) ? new Date(now).toISOString() : null);
}

/**
 * `finished_at` for a finish the export doesn't date (MyAnimeList): noon UTC on 1 January of the title's year (a
 * past year's finish stays out of this week's and this month's numbers), now when the year is unknown or ahead.
 */
export function undatedFinishedAt(titleYear: number | null, now: number): string {
  const at = titleYear ? Date.UTC(titleYear, 0, 1, 12) : now;
  return new Date(Math.min(at, now)).toISOString();
}

/** The user's live entry for the title, if any. */
export type ExistingEntry = { id: string; status: EntryStatus; rating: number | null; review: string | null; hoursPlayed?: number | null };

export type ImportPlan =
  | { action: "insert" }
  | { action: "update"; status: EntryStatus | null; rating: boolean; review: boolean; hours: boolean }
  | { action: "keep"; retried: boolean };

const PROGRESS: Record<EntryStatus, number> = { want: 0, watching: 1, finished: 2 };

/**
 * What importing a title does (idempotent: re-importing adds nothing). A new title is added. A title already there
 * keeps what the user did in Mystonie, except that its status moves forward (wanted → watching → finished, never
 * back), and a missing rating, review or game's hours is filled in. The same row sent again (a retried request) is
 * already saved.
 */
export function planImport(
  row: Pick<ImportRow, "id" | "status" | "rating" | "review" | "hoursPlayed">,
  existing: ExistingEntry | undefined,
): ImportPlan {
  if (!existing) return { action: "insert" };
  if (existing.id === row.id) return { action: "keep", retried: true };
  const status = PROGRESS[row.status] > PROGRESS[existing.status] ? row.status : null;
  const rating = row.rating !== null && existing.rating === null;
  const review = row.review !== null && existing.review === null;
  const hours = (row.hoursPlayed ?? null) !== null && (existing.hoursPlayed ?? null) === null;
  return status || rating || review || hours ? { action: "update", status, rating, review, hours } : { action: "keep", retried: false };
}

/** A title the import brought in (finished, or with episodes or reading logged), for the card. */
export type ImportedTitle = {
  name: string;
  kind: TitleKind;
  posterUrl: string | null;
  /** Watch time the import added: a finished film's runtime, logged episodes' runtimes. */
  minutes: number;
  episodes: number;
  finished: boolean;
  rating: number | null;
  /** First and last day of its imported history, `YYYY-MM-DD` in the user's calendar. */
  from: string;
  to: string;
};

/**
 * The "Imported N films" card's recap: the titles the import brought history for, from the first day to the last,
 * their watch time and episodes, and a collage of the best rated (then the latest). Counted in films, books, …
 * when they're all one kind, else titles. Null when it brought nothing.
 */
export function importRecap(titles: readonly ImportedTitle[]): CardRecap | null {
  if (titles.length === 0) return null;
  const collage = [...titles]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.to.localeCompare(a.to) || a.name.localeCompare(b.name))
    .slice(0, RECAP_COLLAGE_MAX);
  const unit = importUnit(titles.map((t) => t.kind));
  return {
    period: "all",
    imported: true,
    ...(unit === "film" ? {} : { importedUnit: unit }),
    from: titles.map((t) => t.from).sort()[0]!,
    to: titles.map((t) => t.to).sort().at(-1)!,
    minutes: titles.reduce((sum, t) => sum + t.minutes, 0),
    episodes: titles.reduce((sum, t) => sum + t.episodes, 0),
    finished: titles.filter((t) => t.finished).length,
    titleCount: titles.length,
    titles: collage.map((t) => ({ name: t.name, kind: t.kind, posterUrl: t.posterUrl })),
  };
}
