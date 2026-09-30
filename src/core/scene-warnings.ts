// Scene warnings (S3 warnings & quiz, ADR 0043): our own content warnings. Someone who watched, read or played a title
// notes what happens and, if they like, where (S2 · E5 · 41:10–42:30, a chapter or page; a game's cover the whole
// game, S3 games); others who saw it confirm or dispute it. The topic list mirrors the `warning_topics` table, and the database decides everything that counts
// (statuses, the quiz); this file only reads requests and shapes what the UI shows.
import { TITLE_KINDS, type TitleKind } from "./catalog/types";
import { isUuid } from "./email/unsubscribe";
import { isUuidV7 } from "./ids";

export const SCENE_TOPIC_CATEGORIES = ["animals", "scares", "body", "violence", "heavy"] as const;
export type SceneTopicCategory = (typeof SCENE_TOPIC_CATEGORIES)[number];

export type SceneTopic = {
  slug: string;
  /** The same topic on DoesTheDogDie, so the topics people chose to avoid (DTDD ids) flag our warnings too. */
  dtddId: number;
  category: SceneTopicCategory;
  kinds: readonly TitleKind[];
  /** Asked about in the quiz. */
  quiz: boolean;
};

const ALL: readonly TitleKind[] = TITLE_KINDS;
/** What plays on a screen: films, series and games (jump scares, flashing lights, loud noises). */
const SCREEN: readonly TitleKind[] = ["movie", "series", "game"];

/**
 * The topics, in the order the picker shows them. Keep in step with `warning_topics` (migrations 20261007090000 and
 * 20261008090000, which gave games every topic).
 */
export const SCENE_TOPICS = [
  { slug: "dog-dies", dtddId: 153, category: "animals", kinds: ALL, quiz: true },
  { slug: "cat-dies", dtddId: 186, category: "animals", kinds: ALL, quiz: false },
  { slug: "animal-dies", dtddId: 189, category: "animals", kinds: ALL, quiz: true },
  { slug: "animal-cruelty", dtddId: 229, category: "animals", kinds: ALL, quiz: false },
  { slug: "spiders", dtddId: 165, category: "animals", kinds: ALL, quiz: true },
  { slug: "snakes", dtddId: 214, category: "animals", kinds: ALL, quiz: false },
  { slug: "jump-scares", dtddId: 161, category: "scares", kinds: SCREEN, quiz: true },
  { slug: "flashing-lights", dtddId: 167, category: "scares", kinds: SCREEN, quiz: true },
  { slug: "loud-noises", dtddId: 339, category: "scares", kinds: SCREEN, quiz: false },
  { slug: "claustrophobia", dtddId: 202, category: "scares", kinds: ALL, quiz: false },
  { slug: "blood-gore", dtddId: 188, category: "body", kinds: ALL, quiz: true },
  { slug: "needles", dtddId: 190, category: "body", kinds: ALL, quiz: true },
  { slug: "vomit", dtddId: 201, category: "body", kinds: ALL, quiz: true },
  { slug: "eye-injury", dtddId: 200, category: "body", kinds: ALL, quiz: false },
  { slug: "seizure", dtddId: 206, category: "body", kinds: ALL, quiz: false },
  { slug: "gun-violence", dtddId: 232, category: "violence", kinds: ALL, quiz: true },
  { slug: "torture", dtddId: 203, category: "violence", kinds: ALL, quiz: false },
  { slug: "drowning", dtddId: 191, category: "violence", kinds: ALL, quiz: false },
  { slug: "car-crash", dtddId: 184, category: "violence", kinds: ALL, quiz: false },
  { slug: "sexual-assault", dtddId: 182, category: "heavy", kinds: ALL, quiz: true },
  { slug: "suicide", dtddId: 187, category: "heavy", kinds: ALL, quiz: true },
  { slug: "self-harm", dtddId: 199, category: "heavy", kinds: ALL, quiz: true },
  { slug: "child-abuse", dtddId: 218, category: "heavy", kinds: ALL, quiz: false },
  { slug: "domestic-violence", dtddId: 219, category: "heavy", kinds: ALL, quiz: false },
  { slug: "sex-scenes", dtddId: 197, category: "heavy", kinds: ALL, quiz: true },
  { slug: "drug-use", dtddId: 193, category: "heavy", kinds: ALL, quiz: false },
] as const satisfies readonly SceneTopic[];

export type SceneTopicSlug = (typeof SCENE_TOPICS)[number]["slug"];

const BY_SLUG: ReadonlyMap<string, SceneTopic> = new Map(SCENE_TOPICS.map((t) => [t.slug, t]));
const BY_DTDD: ReadonlyMap<number, SceneTopic> = new Map(SCENE_TOPICS.map((t) => [t.dtddId, t]));

export const isSceneTopic = (value: unknown): value is SceneTopicSlug => typeof value === "string" && BY_SLUG.has(value);

/** Our topic that matches a DoesTheDogDie topic id (so it can be named in the user's language), if any. */
export const sceneTopicForDtdd = (dtddId: number): SceneTopicSlug | null => (BY_DTDD.get(dtddId)?.slug as SceneTopicSlug | undefined) ?? null;

/** The DoesTheDogDie topic id of one of ours. */
export const dtddIdFor = (slug: SceneTopicSlug): number => BY_SLUG.get(slug)!.dtddId;

/** The topics a kind of title can have, in picker order. */
export const topicsFor = (kind: TitleKind): SceneTopicSlug[] =>
  SCENE_TOPICS.filter((t) => (t.kinds as readonly TitleKind[]).includes(kind)).map((t) => t.slug);

export const topicCategory = (slug: SceneTopicSlug): SceneTopicCategory => BY_SLUG.get(slug)!.category;

// ---------------------------------------------------------------------------------------------------------------
// Where it happens.

export type SceneUnit = "page" | "chapter" | "volume";

/** Where a warning happens; every part is optional (a warning can be about the whole title). */
export type ScenePlace = {
  season: number | null;
  episode: number | null;
  /** Seconds into the movie or episode. */
  startSec: number | null;
  endSec: number | null;
  unit: SceneUnit | null;
  position: number | null;
};

export const NOWHERE: ScenePlace = { season: null, episode: null, startSec: null, endSec: null, unit: null, position: null };

/** How books and manga say where: a book by chapter or page, a manga by chapter or volume. Everything else: none. */
export function sceneUnitsFor(kind: TitleKind): SceneUnit[] {
  return kind === "book" ? ["chapter", "page"] : kind === "manga" ? ["chapter", "volume"] : [];
}

/** The longest time a request may give (just under a day, as the database allows). */
export const MAX_SCENE_SECONDS = 86_399;
const MAX_POSITION = 100_000;

/**
 * A time as people type it: "41:10" (minutes and seconds), "1:02:13", or "41" (minutes). Seconds and minutes after
 * the first part are 0–59. Null when it can't be read or isn't under a day.
 */
export function parseTimecode(text: string): number | null {
  const parts = text.trim().replace(/[.．]/g, ":").split(":");
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d{1,4}$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n > 59)) return null;
  const seconds = nums.length === 1 ? nums[0]! * 60 : nums.length === 2 ? nums[0]! * 60 + nums[1]! : nums[0]! * 3600 + nums[1]! * 60 + nums[2]!;
  return seconds <= MAX_SCENE_SECONDS ? seconds : null;
}

/** 2470 → "41:10", 3733 → "1:02:13", 5 → "0:05" (as video players show it). */
export function formatTimecode(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${rest}` : `${m}:${rest}`;
}

/**
 * Whether a place suits a kind of title (the same rules the database's insert trigger applies). A game's warning is
 * about the whole game: a game has no fixed timeline.
 */
export function placeFits(kind: TitleKind, place: ScenePlace): boolean {
  if (kind === "game") return place.season === null && place.startSec === null && place.unit === null;
  const screen = kind === "movie" || kind === "series";
  if (kind === "movie" && place.season !== null) return false;
  if (screen && place.unit !== null) return false;
  if (!screen && (place.season !== null || place.startSec !== null)) return false;
  return place.unit === null || sceneUnitsFor(kind).includes(place.unit);
}

// ---------------------------------------------------------------------------------------------------------------
// Requests.

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const intIn = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
/** An optional whole number in range: `undefined`/null → null, a bad value → false. */
const optionalInt = (v: unknown, min: number, max: number): number | null | false => (v === undefined || v === null ? null : intIn(v, min, max) ? v : false);

export type NewSceneWarning = ScenePlace & { id: string; titleId: string; topic: SceneTopicSlug };

/**
 * POST /api/scene-warnings body: `{ id, titleId, topic, season?, episode?, startSec?, endSec?, unit?, position? }`
 * (a v7 id). The season and episode come together, an end needs a start at or before it, a unit needs a position,
 * and a book's or manga's place has no episode or time. Whether it suits the title's kind is the database's check.
 */
export function parseSceneWarning(body: unknown): NewSceneWarning | null {
  if (!isObject(body)) return null;
  const { id, titleId, topic } = body;
  if (typeof id !== "string" || !isUuidV7(id) || typeof titleId !== "string" || !isUuid(titleId) || !isSceneTopic(topic)) return null;
  const season = optionalInt(body.season, 0, 1000);
  const episode = optionalInt(body.episode, 1, 10_000);
  const startSec = optionalInt(body.startSec, 0, MAX_SCENE_SECONDS);
  const endSec = optionalInt(body.endSec, 0, MAX_SCENE_SECONDS);
  const position = optionalInt(body.position, 1, MAX_POSITION);
  const unit = body.unit === undefined || body.unit === null ? null : body.unit === "page" || body.unit === "chapter" || body.unit === "volume" ? body.unit : false;
  if (season === false || episode === false || startSec === false || endSec === false || position === false || unit === false) return null;
  if ((season === null) !== (episode === null) || (unit === null) !== (position === null)) return null;
  if (endSec !== null && (startSec === null || endSec < startSec)) return null;
  if (unit !== null && (season !== null || startSec !== null)) return null;
  return { id: id.toLowerCase(), titleId: titleId.toLowerCase(), topic, season, episode, startSec, endSec, unit, position };
}

/** A vote: 1 "I saw it", -1 "it isn't there", 0 takes one's vote back. */
export type SceneVote = 1 | -1 | 0;

/** PUT /api/scene-warnings/[id] body `{ vote }`. */
export function parseSceneVote(body: unknown): SceneVote | null {
  if (!isObject(body)) return null;
  return body.vote === 1 || body.vote === -1 || body.vote === 0 ? body.vote : null;
}

// ---------------------------------------------------------------------------------------------------------------
// What pages show.

/** Confirmations (its adder counts) that confirm a warning; the same number lives in `private.scene_warning_status`. */
export const SCENE_CONFIRMATIONS = 5;

export type SceneStatus = "pending" | "confirmed" | "disputed";

/** The verification rule, as the database applies it after every vote. */
export function sceneStatus(confirms: number, disputes: number): SceneStatus {
  if (confirms >= SCENE_CONFIRMATIONS && confirms > disputes) return "confirmed";
  if (disputes >= SCENE_CONFIRMATIONS && disputes >= confirms) return "disputed";
  return "pending";
}

export type SceneWarning = ScenePlace & {
  id: string;
  topic: SceneTopicSlug;
  status: SceneStatus;
  confirms: number;
  disputes: number;
  createdAt: string;
  /** Added by the viewer. */
  mine: boolean;
  /** The viewer's vote. */
  myVote: 1 | -1 | null;
};

/** A title-level quiz answer: after ten answers, people who finished it said yes, no, or disagreed. */
export type TopicVerdict = { topic: SceneTopicSlug; result: "yes" | "no" | "contested"; yes: number; no: number };

const place = (w: ScenePlace) => [w.season ?? -1, w.episode ?? -1, w.position ?? -1, w.startSec ?? -1] as const;

/** In viewing order: whole-title warnings first, then by episode, chapter or page, then time. */
export function sortSceneWarnings<T extends ScenePlace & { createdAt: string; id: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => {
    const pa = place(a);
    const pb = place(b);
    for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return pa[i]! - pb[i]!;
    return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  });
}

/** Warnings already there for the same topic at the same episode (or, on other kinds, anywhere): offered to confirm instead. */
export function similarWarnings<T extends ScenePlace & { topic: string; mine: boolean; status: SceneStatus }>(
  list: readonly T[],
  topic: string,
  at: Pick<ScenePlace, "season" | "episode">,
): T[] {
  return list.filter((w) => w.topic === topic && !w.mine && w.status !== "disputed" && w.season === at.season && w.episode === at.episode);
}
