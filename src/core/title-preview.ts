// "Look before you add" (stage 4, ADR 0058): what the ➕ sheet shows about a picked title before it's added. The
// facts come from the catalog's details body (`titles.raw`), the warnings from DoesTheDogDie's cached votes.
import type { Credit } from "./catalog/credits";
import { warningVerdict, type TopicVotes } from "./catalog/dtdd";
import type { Title } from "./catalog/types";
import type { TitleCheck } from "./warnings";

/** How many of DTDD's Yes topics the sheet lists before "and N more". */
export const FLAGGED_MAX = 8;
/** A synopsis longer than this is cut (TMDB's are a paragraph; a few run to pages). */
export const OVERVIEW_MAX = 1200;

/** TMDB's own words about a title. IMDb's rating isn't free to show (ADR 0001), so the score is TMDB's. */
export type TitleFacts = {
  overview: string | null;
  tagline: string | null;
  /** TMDB's average vote out of 10, to one decimal; null without votes. */
  score: number | null;
  votes: number | null;
  /** IMDb's id (`tt0111161`), for a link to its IMDb page. */
  imdbId: string | null;
};

/** A DTDD topic most people said Yes to. */
export type FlaggedTopic = { id: number; name: string; yes: number; no: number };

export type PreviewWarnings =
  | { status: "matched"; url: string; flagged: FlaggedTopic[]; more: number }
  | { status: "unmatched" }
  /** DTDD failed and nothing is cached. */
  | { status: "unavailable" };

/** GET /api/titles/preview/{kind}/{id}. */
export type TitlePreview = {
  title: Title;
  facts: TitleFacts;
  /** A movie's directors (a series' creators), the top-billed cast, and a book's, manga's or game's makers. */
  directors: string[];
  cast: string[];
  makers: string[];
  /** DoesTheDogDie, for movies and series; null for other kinds. */
  warnings: PreviewWarnings | null;
  /** The viewer's avoid-topics against DTDD and our own warnings; null when they chose none. */
  check: TitleCheck | null;
};

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  return s === "" ? null : s;
};
const IMDB_RE = /^tt\d{5,10}$/;

/** Cuts `s` at a word before `max` characters, with an ellipsis. */
function clip(s: string, max: number): string {
  if ([...s].length <= max) return s;
  const cut = [...s].slice(0, max).join("");
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, "")}…`;
}

/**
 * The facts in a `/movie/{id}` or `/tv/{id}` body (as `titles.raw` keeps it). A movie carries `imdb_id`; a series
 * only under `external_ids` (fetched with `append_to_response=external_ids`). Untrusted input: anything odd is null.
 */
export function tmdbFacts(raw: unknown): TitleFacts {
  if (!isObject(raw)) return { overview: null, tagline: null, score: null, votes: null, imdbId: null };
  const votes = typeof raw.vote_count === "number" && Number.isInteger(raw.vote_count) && raw.vote_count > 0 ? raw.vote_count : null;
  const average = typeof raw.vote_average === "number" && raw.vote_average > 0 && raw.vote_average <= 10 ? raw.vote_average : null;
  const imdb = [raw.imdb_id, isObject(raw.external_ids) ? raw.external_ids.imdb_id : null].find((v) => typeof v === "string" && IMDB_RE.test(v));
  const overview = text(raw.overview);
  return {
    overview: overview && clip(overview, OVERVIEW_MAX),
    tagline: text(raw.tagline),
    score: votes && average !== null ? Math.round(average * 10) / 10 : null,
    votes: average !== null ? votes : null,
    imdbId: (imdb as string | undefined) ?? null,
  };
}

/** A title's page on IMDb. */
export const imdbUrl = (imdbId: string) => `https://www.imdb.com/title/${imdbId}/`;

/**
 * DTDD's topics with a Yes verdict, most Yes votes first, without the ones DTDD marks as spoilers (the title page
 * keeps those behind a tap): the first `max`, and how many more there are (spoilers included).
 */
export function flaggedTopics(topics: readonly TopicVotes[], max = FLAGGED_MAX): { flagged: FlaggedTopic[]; more: number } {
  const yes = topics.filter((t) => warningVerdict(t.yes, t.no) === "yes");
  const shown = yes
    .filter((t) => !t.spoiler)
    .sort((a, b) => b.yes - a.yes || a.name.localeCompare(b.name, "en"))
    .slice(0, max)
    .map(({ id, name, yes: y, no }) => ({ id, name, yes: y, no }));
  return { flagged: shown, more: yes.length - shown.length };
}

/** The names of one kind of credit, in billing order. */
export function creditNames(credits: readonly Credit[] | null, role: Credit["role"]): string[] {
  return (credits ?? []).filter((c) => c.role === role).map((c) => c.name);
}
