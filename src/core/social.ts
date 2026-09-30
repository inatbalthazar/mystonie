// Social (S3 social, ADR 0037): follows, Stamps, blocks, the Following feed and finding people. Request parsing and
// the shapes the pages share; the rules themselves live in the database (RLS + security definer functions).
import type { BadgeId } from "./badges";
import type { TitleKind } from "./catalog/types";
import { isUuid } from "./email/unsubscribe";

/** A finish in the Following feed. */
export type FeedItem = {
  entryId: string;
  finishedAt: string;
  rating: number | null;
  review: string | null;
  user: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  title: { id: string; kind: TitleKind; externalId: string; name: string; year: number | null; posterUrl: string | null };
  stampCount: number;
  stamped: boolean;
  /** The owner's latest shared finish card of this title, if any (`imageUrl`: its PNG). */
  card: { id: string; imageUrl: string | null } | null;
  /** Whether this is the viewer's own finish (no Stamp button, just the count). */
  mine: boolean;
  /** Badges this finish earned (S3 badges & shelf), stuck onto the feed card. */
  badges: BadgeId[];
  /** "Finisher #N" of this finish (S3 finishers & the board); null for finishes from before numbering. */
  finisherNo: number | null;
};

/** Something that happened to the viewer: a Stamp on one of their finishes, or a new follower. */
export type ActivityItem = {
  kind: "stamp" | "follow";
  at: string;
  user: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  /** Whether the viewer follows them (a "Follow back" button when not). */
  iFollow: boolean;
  titleName: string | null;
};

export type Person = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  finished: number;
  iFollow: boolean;
};

export type FeedCursor = { before: string; id: string };

export const FEED_PAGE = 20;
export const PEOPLE_QUERY_MIN = 2;
export const PEOPLE_QUERY_MAX = 50;

const record = (body: unknown): Record<string, unknown> | null =>
  typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;

/** POST /api/follows `{ userId, follow }` and POST /api/blocks `{ userId, block }`. */
export function parseUserToggle<K extends "follow" | "block">(body: unknown, key: K): { userId: string; on: boolean } | null {
  const b = record(body);
  if (!b || typeof b.userId !== "string" || !isUuid(b.userId) || typeof b[key] !== "boolean") return null;
  return { userId: b.userId.toLowerCase(), on: b[key] };
}

/** POST /api/stamps `{ entryId, stamped }`. */
export function parseStamp(body: unknown): { entryId: string; stamped: boolean } | null {
  const b = record(body);
  if (!b || typeof b.entryId !== "string" || !isUuid(b.entryId) || typeof b.stamped !== "boolean") return null;
  return { entryId: b.entryId.toLowerCase(), stamped: b.stamped };
}

/**
 * GET /api/feed `?before=<finishedAt>&id=<entryId>`: null for the first page, "invalid" for a half or broken cursor.
 * The time is normalized to an ISO string.
 */
export function parseFeedCursor(params: URLSearchParams): FeedCursor | null | "invalid" {
  const before = params.get("before");
  const id = params.get("id");
  if (before === null && id === null) return null;
  if (!before || !id || !isUuid(id)) return "invalid";
  const ms = Date.parse(before);
  if (!Number.isFinite(ms)) return "invalid";
  return { before: new Date(ms).toISOString(), id: id.toLowerCase() };
}

/** The cursor for the page after `items`, or null when this page wasn't full (nothing more to load). */
export function nextFeedCursor(items: Pick<FeedItem, "finishedAt" | "entryId">[], pageSize = FEED_PAGE): FeedCursor | null {
  const last = items.at(-1);
  return last && items.length >= pageSize ? { before: last.finishedAt, id: last.entryId } : null;
}

/** A people search as typed ("@Kim ", "kim  lee") → what the database matches, or null when too short or too long. */
export function normalizePeopleQuery(raw: string | null): string | null {
  if (raw === null) return null;
  const q = raw.normalize("NFKC").trim().replace(/^@+/, "").replace(/\s+/g, " ").toLowerCase();
  const length = [...q].length;
  return length >= PEOPLE_QUERY_MIN && length <= PEOPLE_QUERY_MAX ? q : null;
}
