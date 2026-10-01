// Content warnings (S2): what the warnings routes accept. The DTDD data itself is in ./catalog/dtdd; our own scene
// warnings (S3) are in ./scene-warnings.
import { warningVerdict } from "./catalog/dtdd";
import { isExternalId, isTitleKind, type TitleKind } from "./catalog/types";
import { dtddIdFor, type SceneTopicSlug } from "./scene-warnings";

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

/**
 * "Check for family viewing" (stage 4): the topics a one-tap check uses for someone who chose none. Our own topics
 * (DoesTheDogDie ids), so every kind can answer them: animal deaths, jump scares, gore, violence and the heavy ones.
 */
export const FAMILY_TOPICS = [
  "dog-dies",
  "animal-dies",
  "jump-scares",
  "blood-gore",
  "gun-violence",
  "torture",
  "sexual-assault",
  "suicide",
  "self-harm",
  "child-abuse",
  "sex-scenes",
  "drug-use",
] as const satisfies readonly SceneTopicSlug[];

export const FAMILY_TOPIC_IDS: readonly number[] = FAMILY_TOPICS.map(dtddIdFor);

/** One avoided topic in a title check: DTDD's name and votes when it has them. */
export type CheckTopic = { id: number; name?: string; yes?: number; no?: number; ours: boolean };

/**
 * A title's pre-watch check against the user's avoid-topics:
 * - `hits`: DTDD's rule says Yes, or our own confirmed warnings or quiz say yes.
 * - `clear`: DTDD knows the title and nothing hits; `sure` counts the topics people said No to, `unsure` the rest.
 * - `unknown`: no DTDD data (unmatched, failed, or a book, manga or game) and none of our own hits.
 */
export type TitleCheck =
  | { verdict: "hits"; hits: CheckTopic[] }
  | { verdict: "clear"; sure: number; unsure: number }
  | { verdict: "unknown" };

/**
 * `dtdd`: DTDD's votes for the title (null when it has none for it); `ours`: the avoid-topic ids our own warnings
 * flag. Hits keep the order of `avoid`.
 */
export function titleCheck(
  avoid: readonly number[],
  dtdd: readonly { id: number; name: string; yes: number; no: number }[] | null,
  ours: readonly number[],
): TitleCheck {
  const votes = new Map((dtdd ?? []).map((t) => [t.id, t]));
  const hits: CheckTopic[] = [];
  let sure = 0;
  for (const id of new Set(avoid)) {
    const v = votes.get(id);
    const verdict = v ? warningVerdict(v.yes, v.no) : null;
    const mine = ours.includes(id);
    if (verdict === "yes" || mine) hits.push({ id, ...(v ? { name: v.name, yes: v.yes, no: v.no } : {}), ours: mine });
    else if (verdict === "no") sure++;
  }
  if (hits.length > 0) return { verdict: "hits", hits };
  if (!dtdd) return { verdict: "unknown" };
  return { verdict: "clear", sure, unsure: new Set(avoid).size - sure };
}
