// Collection entries: validation of quick-add / edit requests, the finish date, and list order
// (S1 collection, ADR 0021). Shared by the route handlers (authoritative) and the optimistic UI.
import { isExternalId, isTitleKind, sourceForKind, type CatalogSource, type TitleKind } from "../catalog/types";
import { isUuidV7 } from "../ids";
import { localDateKey, safeTimeZone, startOfLocalDay } from "../stats/period";

export const ENTRY_STATUSES = ["want", "watching", "finished"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export function isEntryStatus(value: unknown): value is EntryStatus {
  return typeof value === "string" && (ENTRY_STATUSES as readonly string[]).includes(value);
}

/** A title as the collection shows it. `id` is the `titles` row once the server has it. */
export type CollectionTitle = {
  id?: string;
  source: CatalogSource;
  kind: TitleKind;
  externalId: string;
  name: string;
  year: number | null;
  posterUrl: string | null;
  /** Catalog details, known once the server has the title (optimistic rows may lack them). */
  genres?: string[];
  /** Movie runtime, or the typical episode runtime of a series. */
  runtimeMin?: number | null;
  episodeCount?: number | null;
  /** Books: pages. Manga: chapters and volumes (null while a series runs). */
  pageCount?: number | null;
  chapterCount?: number | null;
  volumeCount?: number | null;
  /** Games: RAWG's average playtime, hours. */
  playtimeHours?: number | null;
};

export type CollectionItem = {
  id: string;
  status: EntryStatus;
  /** Set exactly when `status` is finished (database check). */
  finishedAt: string | null;
  addedAt: string;
  /** 0.5–5 in half steps, and the one-line review (asked after the celebration). */
  rating?: number | null;
  review?: string | null;
  /** A game: the hours the player says it took (asked after the celebration too). */
  hoursPlayed?: number | null;
  /** How rare the finish was (ADR 0067): the share of Mystonie that had finished the title then, or null (`shownShare`). */
  finishShare?: number | null;
  title: CollectionTitle;
};

/** Identifies a title across optimistic and saved items (one live entry per title). */
export function titleKey(title: Pick<CollectionTitle, "source" | "kind" | "externalId">): string {
  return `${title.source}:${title.kind}:${title.externalId}`;
}

/** Newest first by finish date, or by when it was added for want/watching. Ties: newest id (UUID v7). */
export function sortCollection<T extends Pick<CollectionItem, "id" | "finishedAt" | "addedAt">>(items: readonly T[]): T[] {
  const at = (item: T) => Date.parse(item.finishedAt ?? item.addedAt) || 0;
  return [...items].sort((a, b) => at(b) - at(a) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

// A finish date may be a little ahead of the server clock (device clock, time zones), never days ahead.
const MAX_AHEAD_MS = 24 * 60 * 60 * 1000;
const EARLIEST = Date.UTC(1900, 0, 1);

function validFinishedAt(value: unknown, now: number): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const t = Date.parse(value);
  if (Number.isNaN(t) || t < EARLIEST || t > now + MAX_AHEAD_MS) return null;
  return new Date(t).toISOString();
}

/**
 * When the user made a change, by the device's clock (`editedAt`, `watchedAt`, `readAt`). A change made offline reaches
 * the server later but keeps its own time (S3 offline, ADR 0042). Missing means now; a time a little ahead (clock drift)
 * is clamped to now; null for anything else.
 */
export function actionTime(value: unknown, now: number = Date.now()): string | null {
  if (value === undefined || value === null) return new Date(now).toISOString();
  const valid = validFinishedAt(value, now);
  return valid && new Date(Math.min(Date.parse(valid), now)).toISOString();
}

/**
 * `finished_at` for a date picked in the finish-date field (the user's time zone): now when it's today,
 * else noon that day (a stable time that stays inside the day across DST). Null for a bad or future date.
 */
export function finishedAtForDate(date: string, timeZone: string, now: number = Date.now()): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const zone = safeTimeZone(timeZone);
  const today = localDateKey(now, zone);
  if (date === today) return new Date(now).toISOString();
  if (date > today) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const start = startOfLocalDay(year, month, day, zone);
  if (localDateKey(start, zone) !== date) return null; // 2026-02-31 and the like
  const noon = start + 12 * 60 * 60 * 1000;
  return noon < EARLIEST ? null : new Date(noon).toISOString();
}

/** The first year quick add offers for a finish known only by its year. */
export const FIRST_FINISH_YEAR = 1900;

/**
 * When a finish happened, as quick add asks it (ADR 0096): today, yesterday, a picked day, or only the year (for
 * the ones from years ago nobody remembers the day of).
 */
export type FinishWhen = { on: "today" } | { on: "yesterday" } | { on: "day"; date: string } | { on: "year"; year: number };

/** The user's calendar day before `today` (`YYYY-MM-DD`). */
function dayBefore(today: string, zone: string): string {
  const [year, month, day] = today.split("-").map(Number) as [number, number, number];
  return localDateKey(startOfLocalDay(year, month, day, zone) - 12 * 60 * 60 * 1000, zone);
}

/** The day a `FinishWhen` stands for in the user's calendar: a year alone is 1 January (as imports date it, ADR 0041). */
function finishDay(when: FinishWhen, zone: string, now: number): string | null {
  const today = localDateKey(now, zone);
  if (when.on === "today") return today;
  if (when.on === "yesterday") return dayBefore(today, zone);
  if (when.on === "day") return when.date;
  const year = when.year;
  return Number.isInteger(year) && year >= FIRST_FINISH_YEAR && year <= Number(today.slice(0, 4)) ? `${year}-01-01` : null;
}

/** `finished_at` for a `FinishWhen`, by `finishedAtForDate`. Null for a bad or future day or year. */
export function finishedAtFor(when: FinishWhen, timeZone: string, now: number = Date.now()): string | null {
  const zone = safeTimeZone(timeZone);
  const day = finishDay(when, zone, now);
  return day && finishedAtForDate(day, zone, now);
}

/**
 * A finish from before yesterday (ADR 0096): filling in the past, so quick add pastes it in quietly and stays open
 * for the next one instead of celebrating each. Today's and yesterday's finishes get the celebration and the card.
 */
export function isPastFinish(when: FinishWhen, timeZone: string, now: number = Date.now()): boolean {
  if (when.on === "today" || when.on === "yesterday") return false;
  const zone = safeTimeZone(timeZone);
  const day = finishDay(when, zone, now);
  return !!day && day < dayBefore(localDateKey(now, zone), zone);
}

/** The columns a status change writes: finished keeps or gets a date, other statuses clear it. */
export function statusColumns(status: EntryStatus, finishedAt: string | null | undefined, now: number) {
  return { status, finishedAt: status === "finished" ? (finishedAt ?? new Date(now).toISOString()) : null };
}

export type NewEntry = {
  id: string;
  title: Pick<CollectionTitle, "source" | "kind" | "externalId">;
  status: EntryStatus;
  finishedAt: string | null;
  /** When the user made the change (`actionTime`): an older change doesn't replace a newer one. */
  editedAt: string;
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** POST /api/entries body → a new entry, or null when anything is off. */
export function parseNewEntry(body: unknown, now: number = Date.now()): NewEntry | null {
  if (!isObject(body) || !isObject(body.title)) return null;
  const { id, status, finishedAt } = body;
  const { source, kind, externalId } = body.title;
  if (typeof id !== "string" || !isUuidV7(id) || !isEntryStatus(status)) return null;
  if (!isTitleKind(kind) || source !== sourceForKind(kind) || !isExternalId(kind, externalId)) return null;
  const editedAt = actionTime(body.editedAt, now);
  if (!editedAt) return null;
  let date: string | null = null;
  if (finishedAt !== undefined && finishedAt !== null) {
    date = validFinishedAt(finishedAt, now);
    if (!date) return null;
  }
  return { id, title: { source: sourceForKind(kind), kind, externalId }, ...statusColumns(status, date, Date.parse(editedAt)), editedAt };
}

/**
 * What's asked after the celebration: the rating and review, and for a game the hours played (absent: left as it is).
 */
export type EntryNotes = { rating: number | null; review: string | null; hoursPlayed?: number | null };

/** Most hours a game's entry takes (the database's limit). */
export const MAX_HOURS_PLAYED = 9999;

/** Whether `v` is an hours-played value: a whole number of hours, 1–9999. */
export const isHoursPlayed = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_HOURS_PLAYED;

export type EntryPatch = (
  | { deleted: true }
  | { deleted?: false; status: EntryStatus; finishedAt: string | null }
  | { deleted?: false; notes: EntryNotes }
) & {
  /** When the user made the change (`actionTime`): an older change doesn't replace a newer one. */
  editedAt: string;
};

/** Longest review the database accepts (characters). The card prints at most `REVIEW_MAX_CHARS` of it. */
export const ENTRY_REVIEW_MAX = 280;

/**
 * `{ rating, review, hoursPlayed? }` from the celebration: a half-step rating or null, a trimmed review or null, and
 * optionally whole hours played (1–9999) or null.
 */
function parseNotes(body: Record<string, unknown>): EntryNotes | null {
  const { rating, review, hoursPlayed } = body;
  if (rating !== null && !(typeof rating === "number" && rating >= 0.5 && rating <= 5 && Number.isInteger(rating * 2))) {
    return null;
  }
  if (review !== null && typeof review !== "string") return null;
  const text = review?.replace(/\s+/g, " ").trim() || null;
  if (text && [...text].length > ENTRY_REVIEW_MAX) return null;
  if (hoursPlayed !== undefined && hoursPlayed !== null && !isHoursPlayed(hoursPlayed)) return null;
  return { rating, review: text, ...(hoursPlayed === undefined ? {} : { hoursPlayed }) };
}

/**
 * PATCH /api/entries/[id] body: `{ status, finishedAt? }`, `{ rating, review, hoursPlayed? }` (null clears) or
 * `{ deleted: true }` (soft delete), each with an optional `editedAt` (when the change was made, default now).
 */
export function parseEntryPatch(body: unknown, now: number = Date.now()): EntryPatch | null {
  if (!isObject(body)) return null;
  const editedAt = actionTime(body.editedAt, now);
  if (!editedAt) return null;
  if (body.deleted === true) return { deleted: true, editedAt };
  if (body.status === undefined && "rating" in body && "review" in body) {
    const notes = parseNotes(body);
    return notes && { notes, editedAt };
  }
  if (!isEntryStatus(body.status)) return null;
  let date: string | null = null;
  if (body.finishedAt !== undefined && body.finishedAt !== null) {
    date = validFinishedAt(body.finishedAt, now);
    if (!date) return null;
  }
  return { ...statusColumns(body.status, date, Date.parse(editedAt)), editedAt };
}
