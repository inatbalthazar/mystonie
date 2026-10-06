// Social (S3 social, ADR 0037): follows, Stamps, blocks, the Following feed and finding people. Request parsing and
// the shapes the pages share; the rules themselves live in the database (RLS + security definer functions).
import type { BadgeId } from "./badges";
import type { TitleKind } from "./catalog/types";
import { isUuid } from "./email/unsubscribe";
import type { MascotCheer, Official } from "./official";

/** Someone shown by name: their page, photo and, for Stonie and the team, their label (ADR 0098). */
export type PersonRef = { id: string; username: string; displayName: string | null; avatarUrl: string | null; official: Official | null };

/** A finish in the Following feed. */
export type FeedItem = {
  entryId: string;
  finishedAt: string;
  rating: number | null;
  review: string | null;
  user: PersonRef;
  title: { id: string; kind: TitleKind; externalId: string; name: string; year: number | null; posterUrl: string | null };
  stampCount: number;
  stamped: boolean;
  /** The owner's latest shared finish card of this title, if any (`imageUrl`: its PNG). */
  card: { id: string; imageUrl: string | null } | null;
  /** Whether this is the viewer's own finish (no Stamp button, just the count). */
  mine: boolean;
  /** Badges this finish earned (S3 badges & shelf), stuck onto the feed card. */
  badges: BadgeId[];
  /** How rare this finish was (ADR 0067), or null (`shownShare`): the feed tags it when it's rare. */
  finishShare: number | null;
};

/**
 * Something that happened to the viewer: a Stamp on one of their finishes, a new follower, or a friend who joined
 * from their invite (ADR 0098).
 */
export type ActivityItem = {
  kind: "stamp" | "follow" | "invite";
  at: string;
  user: PersonRef;
  /** Stonie's Stamp: the milestone that finish reached (ADR 0098). */
  cheer: MascotCheer | null;
  /** Whether the viewer follows them (a "Follow back" button when not). */
  iFollow: boolean;
  titleName: string | null;
};

export type Person = PersonRef & {
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

/** Someone suggested on Find people (ADR 0083), with what they have in common with the viewer. */
export type SuggestedPerson = PersonRef & {
  finished: number;
  /** Titles both have in their collections, and one of them by name. */
  shared: number;
  sharedTitle: string | null;
  /** People the viewer follows who follow them. */
  mutuals: number;
  /** A club both are in (its slug). */
  club: string | null;
  /** A country they lived in (public Atlas) that is the viewer's own. */
  country: string | null;
};

/** The one line a suggestion shows: why this person. */
export type SuggestionReason =
  | { kind: "mutuals"; count: number }
  | { kind: "shared"; count: number; title: string }
  | { kind: "club"; club: string }
  | { kind: "country"; country: string }
  | { kind: "active"; finished: number };

/**
 * Why someone is suggested, the strongest reason first: several people you follow follow them, then titles in common,
 * then a shared club, a country you share, one person you follow, and last, that they finish a lot.
 */
export function suggestionReason(p: Pick<SuggestedPerson, "finished" | "shared" | "sharedTitle" | "mutuals" | "club" | "country">): SuggestionReason {
  if (p.mutuals >= 2) return { kind: "mutuals", count: p.mutuals };
  if (p.shared > 0 && p.sharedTitle) return { kind: "shared", count: p.shared, title: p.sharedTitle };
  if (p.club) return { kind: "club", club: p.club };
  if (p.country) return { kind: "country", country: p.country };
  if (p.mutuals === 1) return { kind: "mutuals", count: 1 };
  return { kind: "active", finished: p.finished };
}
