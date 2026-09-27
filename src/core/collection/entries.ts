// Collection entries: validation of quick-add / edit requests, the finish date, and list order
// (S1 collection, ADR 0021). Shared by the route handlers (authoritative) and the optimistic UI.
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
  source: "tmdb";
  kind: "movie" | "series";
  externalId: string;
  name: string;
  year: number | null;
  posterUrl: string | null;
  /** Catalog details, known once the server has the title (optimistic rows may lack them). */
  genres?: string[];
  /** Movie runtime, or the typical episode runtime of a series. */
  runtimeMin?: number | null;
  episodeCount?: number | null;
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

/** The columns a status change writes: finished keeps or gets a date, other statuses clear it. */
export function statusColumns(status: EntryStatus, finishedAt: string | null | undefined, now: number) {
  return { status, finishedAt: status === "finished" ? (finishedAt ?? new Date(now).toISOString()) : null };
}

export type NewEntry = {
  id: string;
  title: Pick<CollectionTitle, "source" | "kind" | "externalId">;
  status: EntryStatus;
  finishedAt: string | null;
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** POST /api/entries body → a new entry, or null when anything is off. */
export function parseNewEntry(body: unknown, now: number = Date.now()): NewEntry | null {
  if (!isObject(body) || !isObject(body.title)) return null;
  const { id, status, finishedAt } = body;
  const { source, kind, externalId } = body.title;
  if (typeof id !== "string" || !isUuidV7(id) || !isEntryStatus(status)) return null;
  if (source !== "tmdb" || (kind !== "movie" && kind !== "series")) return null;
  if (typeof externalId !== "string" || !/^\d{1,10}$/.test(externalId)) return null;
  let date: string | null = null;
  if (finishedAt !== undefined && finishedAt !== null) {
    date = validFinishedAt(finishedAt, now);
    if (!date) return null;
  }
  return { id, title: { source, kind, externalId }, ...statusColumns(status, date, now) };
}

export type EntryNotes = { rating: number | null; review: string | null };

export type EntryPatch =
  | { deleted: true }
  | { deleted?: false; status: EntryStatus; finishedAt: string | null }
  | { deleted?: false; notes: EntryNotes };

/** Longest review the database accepts (characters). The card prints at most `REVIEW_MAX_CHARS` of it. */
export const ENTRY_REVIEW_MAX = 280;

/** `{ rating, review }` from the celebration: a half-step rating or null, a trimmed review or null. */
function parseNotes(body: Record<string, unknown>): EntryNotes | null {
  const { rating, review } = body;
  if (rating !== null && !(typeof rating === "number" && rating >= 0.5 && rating <= 5 && Number.isInteger(rating * 2))) {
    return null;
  }
  if (review !== null && typeof review !== "string") return null;
  const text = review?.replace(/\s+/g, " ").trim() || null;
  if (text && [...text].length > ENTRY_REVIEW_MAX) return null;
  return { rating, review: text };
}

/**
 * PATCH /api/entries/[id] body: `{ status, finishedAt? }`, `{ rating, review }` (both, null clears) or
 * `{ deleted: true }` (soft delete).
 */
export function parseEntryPatch(body: unknown, now: number = Date.now()): EntryPatch | null {
  if (!isObject(body)) return null;
  if (body.deleted === true) return { deleted: true };
  if (body.status === undefined && "rating" in body && "review" in body) {
    const notes = parseNotes(body);
    return notes && { notes };
  }
  if (!isEntryStatus(body.status)) return null;
  let date: string | null = null;
  if (body.finishedAt !== undefined && body.finishedAt !== null) {
    date = validFinishedAt(body.finishedAt, now);
    if (!date) return null;
  }
  return statusColumns(body.status, date, now);
}
