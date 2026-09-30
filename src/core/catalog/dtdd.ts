// Content warnings (S2, ADR 0009): DoesTheDogDie's topics and per-title yes/no community votes, normalized.
// Input is untrusted: every field is checked, and unusable entries are dropped. Endpoints and terms:
// docs/architecture/external-apis.md (`GET /dddsearch?q=`, `GET /media/{id}`, `GET /categories`).
import type { TmdbKind } from "./tmdb";

export const DTDD_URL = "https://www.doesthedogdie.com";

/** DTDD's page for a matched title (the "see the details" link). */
export const dtddMediaUrl = (dtddId: number) => `${DTDD_URL}/media/${dtddId}`;

/** A warning topic ("a dog dies"), grouped by DTDD's category ("Animal Death"). */
export type WarningTopic = {
  id: number;
  name: string;
  category: string;
  /** DTDD marks topics whose answer gives the plot away ("a major character dies"): shown only after a tap. */
  spoiler: boolean;
};

/** One topic's community votes on one title, and the top comment (hidden behind a tap). */
export type TopicVotes = WarningTopic & { yes: number; no: number; comment: string | null };

/** What a warnings source knows about a title (ADR 0009: our own community data can be merged in later). */
export type TitleWarnings =
  | { status: "matched"; sourceId: number; sourceUrl: string; topics: TopicVotes[] }
  /** No confident match: shown as "No warning data yet" and no badge. */
  | { status: "unmatched" };

/** The title a provider looks up. */
export type WarningTitle = { kind: TmdbKind; externalId: string; name: string; originalName: string | null; year: number | null; imdbId: string | null };

/** A source of warnings (DTDD now; our own community data later). */
export interface WarningsProvider {
  lookup(title: WarningTitle): Promise<TitleWarnings>;
}

// ---------------------------------------------------------------------------------------------------------------
// The "Yes" rule (S2 content warnings, open question Q4).

export type WarningVerdict = "yes" | "no" | "unclear";

/** Votes a side needs before it counts. */
export const VERDICT_MIN_VOTES = 3;

/** yes ≥ 3 and yes > no → Yes; no ≥ 3 and no > yes → No; anything else is Unclear. */
export function warningVerdict(yes: number, no: number): WarningVerdict {
  if (yes >= VERDICT_MIN_VOTES && yes > no) return "yes";
  if (no >= VERDICT_MIN_VOTES && no > yes) return "no";
  return "unclear";
}

/** The avoid-topics a title has a Yes for, in the order of `avoid`. */
export function avoidHits<T extends { id: number; yes: number; no: number }>(topics: readonly T[], avoid: readonly number[]): T[] {
  const byId = new Map(topics.map((t) => [t.id, t]));
  return avoid.map((id) => byId.get(id)).filter((t): t is T => !!t && warningVerdict(t.yes, t.no) === "yes");
}

// ---------------------------------------------------------------------------------------------------------------
// Survived cards: a finish celebration offers one when DTDD says Yes to one of these (the first that matches).

export const SURVIVED_TOPICS = [
  { id: 161, key: "jumpScares" },
  { id: 397, key: "zombies" },
  { id: 224, key: "possession" },
  { id: 207, key: "ghosts" },
  { id: 174, key: "clowns" },
  { id: 394, key: "dolls" },
  { id: 188, key: "gore" },
  { id: 165, key: "spiders" },
  { id: 214, key: "snakes" },
  { id: 337, key: "sharks" },
  { id: 190, key: "needles" },
] as const;

export type SurvivedKey = (typeof SURVIVED_TOPICS)[number]["key"];

export const SURVIVED_KEYS: readonly SurvivedKey[] = SURVIVED_TOPICS.map((t) => t.key);

export const SURVIVED_TOPIC_IDS: readonly number[] = SURVIVED_TOPICS.map((t) => t.id);

export function isSurvivedKey(v: unknown): v is SurvivedKey {
  return typeof v === "string" && (SURVIVED_KEYS as readonly string[]).includes(v);
}

/** The scare a title's finish can be a Survived card about, or null. */
export function survivedTopic(topics: readonly { id: number; yes: number; no: number }[]): SurvivedKey | null {
  for (const s of SURVIVED_TOPICS) {
    const t = topics.find((x) => x.id === s.id);
    if (t && warningVerdict(t.yes, t.no) === "yes") return s.key;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Normalizers.

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const posInt = (v: unknown, max = 100_000_000): v is number => Number.isInteger(v) && (v as number) > 0 && (v as number) <= max;
const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? Math.min(v as number, 10_000_000) : 0);
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

const TOPIC_MAX = 200;
const CATEGORY_MAX = 80;
export const COMMENT_MAX = 500;

/** A topic from `/categories` or inside a `/media` stat; null when unusable, hidden or merged away. */
function topic(raw: unknown): WarningTopic | null {
  if (!isObject(raw) || !posInt(raw.id, 100_000)) return null;
  if (raw.isVisible === false || raw.mergedIntoTopicId || raw.hiddenByAdmin === true) return null;
  const name = clean(raw.name, TOPIC_MAX);
  if (!name) return null;
  const category = (isObject(raw.TopicCategory) && clean(raw.TopicCategory.name, CATEGORY_MAX)) || "Other";
  return { id: raw.id, name, category, spoiler: raw.isSpoiler === true };
}

/** `/categories` (every topic) → topics sorted by category, then name. */
export function normalizeDtddTopics(body: unknown): WarningTopic[] {
  const list = Array.isArray(body) ? body : [];
  const seen = new Map<number, WarningTopic>();
  for (const raw of list) {
    const t = topic(raw);
    if (t && !seen.has(t.id)) seen.set(t.id, t);
  }
  return [...seen.values()].sort((a, b) => a.category.localeCompare(b.category, "en") || a.name.localeCompare(b.name, "en"));
}

/** `/media/{id}` → the topics anyone voted on (a topic without votes says nothing). */
export function normalizeDtddMedia(body: unknown): TopicVotes[] {
  const stats = isObject(body) && Array.isArray(body.topicItemStats) ? body.topicItemStats : [];
  const seen = new Map<number, TopicVotes>();
  for (const raw of stats) {
    if (!isObject(raw)) continue;
    const t = topic(raw.topic);
    if (!t || (posInt(raw.TopicId) && raw.TopicId !== t.id) || seen.has(t.id)) continue;
    const yes = count(raw.yesSum);
    const no = count(raw.noSum);
    if (yes + no === 0) continue;
    seen.set(t.id, { ...t, yes, no, comment: clean(raw.comment, COMMENT_MAX) || null });
  }
  return [...seen.values()];
}

/** A DTDD search hit. `type` is "other" for books, games and everything we don't match against. */
export type DtddItem = { id: number; name: string; year: number | null; type: TmdbKind | "other"; tmdbId: number | null; imdbId: string | null };

const IMDB_RE = /^tt\d{5,10}$/;

function dtddType(raw: Json): DtddItem["type"] {
  const name = isObject(raw.itemType) ? raw.itemType.name : null;
  if (name === "Movie" || raw.ItemTypeId === 15) return "movie";
  if (name === "TV Show" || raw.ItemTypeId === 16) return "series";
  return "other";
}

/** `/dddsearch?q=` → its items (DTDD's order). */
export function normalizeDtddSearch(body: unknown): DtddItem[] {
  const items = isObject(body) && Array.isArray(body.items) ? body.items : [];
  const out: DtddItem[] = [];
  for (const raw of items) {
    if (!isObject(raw) || !posInt(raw.id)) continue;
    const name = clean(raw.name, 300);
    if (!name) continue;
    const year = typeof raw.releaseYear === "string" && /^\d{4}$/.test(raw.releaseYear) ? Number(raw.releaseYear) : null;
    const tmdbId = posInt(raw.tmdbid) ? raw.tmdbid : typeof raw.tmdbid === "string" && /^\d{1,10}$/.test(raw.tmdbid) ? Number(raw.tmdbid) : null;
    const imdbId = typeof raw.imdbId === "string" && IMDB_RE.test(raw.imdbId) ? raw.imdbId : null;
    out.push({ id: raw.id, name, year, type: dtddType(raw), tmdbId, imdbId });
  }
  return out;
}

/** Lower case, accents and punctuation dropped, a leading article dropped: "The Office" = "office". */
export function matchName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^(the|a|an) /, "");
}

/**
 * The DTDD item for our title: by TMDB id (or IMDb id) when DTDD has one, else the only item of the same type and
 * year whose name matches ours (and that isn't tied to another TMDB title). Anything ambiguous is no match.
 */
export function matchDtddItem(items: readonly DtddItem[], title: WarningTitle): DtddItem | null {
  const sameType = items.filter((i) => i.type === title.kind);
  const tmdbId = Number(title.externalId);
  const byId = sameType.find((i) => i.tmdbId === tmdbId) ?? (title.imdbId ? sameType.find((i) => i.imdbId === title.imdbId) : undefined);
  if (byId) return byId;
  if (title.year === null) return null;
  const names = new Set([title.name, title.originalName].filter((n): n is string => !!n).map(matchName));
  const candidates = sameType.filter((i) => i.tmdbId === null && i.year === title.year && names.has(matchName(i.name)));
  const unique = new Map(candidates.map((i) => [i.id, i]));
  return unique.size === 1 ? [...unique.values()][0]! : null;
}
