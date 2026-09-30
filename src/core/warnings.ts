// Content warnings (S2): what the warnings routes accept. The DTDD data itself is in ./catalog/dtdd; our own scene
// warnings (S3) are in ./scene-warnings.
import { isExternalId, isTitleKind, type TitleKind } from "./catalog/types";

/** At most this many avoid-topics per user (DTDD has about 300; the database allows 500). */
export const AVOID_MAX = 300;

/** At most this many titles per badge lookup (a page of search results). */
export const BADGE_TITLES_MAX = 40;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const topicId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0 && (v as number) <= 100_000;

/** `PUT /api/warnings/topics` body `{ topicIds }` → the ids, deduplicated, or null. */
export function parseAvoidTopics(body: unknown): number[] | null {
  if (!isObject(body) || !Array.isArray(body.topicIds) || body.topicIds.length > AVOID_MAX) return null;
  if (!body.topicIds.every(topicId)) return null;
  return [...new Set(body.topicIds as number[])];
}

export type BadgeTitle = { kind: TitleKind; externalId: string };

/**
 * `POST /api/warnings/badges` body `{ titles: [{ kind, externalId }] }` → the titles, or null. Any kind: DTDD's votes
 * cover movies and series, our own warnings (S3) every kind.
 */
export function parseBadgeTitles(body: unknown): BadgeTitle[] | null {
  if (!isObject(body) || !Array.isArray(body.titles) || body.titles.length > BADGE_TITLES_MAX) return null;
  const out: BadgeTitle[] = [];
  for (const t of body.titles) {
    if (!isObject(t) || !isTitleKind(t.kind) || !isExternalId(t.kind, t.externalId)) return null;
    out.push({ kind: t.kind, externalId: t.externalId });
  }
  return out;
}

/** The key a badge is filed under in `/api/warnings/badges` answers. */
export const badgeKey = (t: BadgeTitle) => `${t.kind}:${t.externalId}`;

/**
 * One avoided topic a title has a Yes for: its DoesTheDogDie topic id, and DTDD's name for it. A Yes that comes only
 * from our own warnings has no name here: those topics are ours, and the app names them in the viewer's language.
 */
export type BadgeTopic = { id: number; name?: string };

/** DTDD's Yes topics and our own warnings' topic ids for one title, one per topic id, DTDD's first. */
export function mergeBadgeTopics(dtdd: readonly BadgeTopic[], ours: readonly number[]): BadgeTopic[] {
  const out = new Map<number, BadgeTopic>();
  for (const t of dtdd) if (!out.has(t.id)) out.set(t.id, t);
  for (const id of ours) if (!out.has(id)) out.set(id, { id });
  return [...out.values()];
}
