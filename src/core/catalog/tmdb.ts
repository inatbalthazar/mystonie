// Normalizes TMDB v3 JSON (search/multi, trending/all/week, movie/{id}, tv/{id}, tv/{id}/season/{n}).
// Input is untrusted: every field is checked, and unusable items are dropped.
import type { Episode, SearchResult, Title } from "./types";

export type TmdbKind = "movie" | "series";

const IMAGE_BASE = "https://image.tmdb.org/t/p/";

export type TmdbImageSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original";

export function tmdbImageUrl(path: string, size: TmdbImageSize): string {
  return `${IMAGE_BASE}${size}${path}`;
}

/** TMDB calls series "tv" in URLs and `media_type`. */
export function tmdbMediaType(kind: TmdbKind): "movie" | "tv" {
  return kind === "series" ? "tv" : "movie";
}

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
const count = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined;
const id = (v: unknown): string | undefined =>
  typeof v === "number" && Number.isInteger(v) && v > 0 ? String(v) : undefined;
const path = (v: unknown): string | undefined => {
  const p = text(v);
  return p?.startsWith("/") ? p : undefined;
};

/** "2016-07-15" → 2016. Outside the range the database accepts → undefined. */
function yearOf(date: unknown): number | undefined {
  const match = text(date)?.match(/^(\d{4})-/);
  const year = match ? Number(match[1]) : undefined;
  return year !== undefined && year >= 1800 && year <= 2200 ? year : undefined;
}

type Common = {
  kind: TmdbKind;
  externalId: string;
  name: string;
  originalName?: string;
  originalLanguage?: string;
  year?: number;
  posterPath?: string;
};

function common(raw: unknown, kind?: TmdbKind): Common | null {
  if (!isObject(raw) || raw.adult === true) return null;
  const k = kind ?? (raw.media_type === "movie" ? "movie" : raw.media_type === "tv" ? "series" : null);
  if (!k) return null; // people, collections, …
  const externalId = id(raw.id);
  const name = k === "movie" ? text(raw.title) : text(raw.name);
  if (!externalId || !name) return null;
  return {
    kind: k,
    externalId,
    name,
    originalName: k === "movie" ? text(raw.original_title) : text(raw.original_name),
    originalLanguage: text(raw.original_language),
    year: yearOf(k === "movie" ? raw.release_date : raw.first_air_date),
    posterPath: path(raw.poster_path),
  };
}

/**
 * Items from `/trending/all/week` (mixed, tagged with `media_type`) or from a typed list
 * like `/search/tv` (pass `kind`): movies and series only.
 */
export function normalizeTmdbList(body: unknown, kind?: TmdbKind): SearchResult[] {
  return rankedList(body, kind).map((r) => r.result);
}

/**
 * Search results from `/search/movie` + `/search/tv`, merged by TMDB popularity.
 * (`/search/multi` also returns people, which crowd out titles for partial words like "strang".)
 */
export function mergeTmdbSearch(movies: unknown, series: unknown, limit = 20): SearchResult[] {
  return [...rankedList(movies, "movie"), ...rankedList(series, "series")]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit)
    .map((r) => r.result);
}

function rankedList(body: unknown, kind?: TmdbKind): { result: SearchResult; popularity: number }[] {
  if (!isObject(body) || !Array.isArray(body.results)) return [];
  return body.results.flatMap((raw) => {
    const c = common(raw, kind);
    if (!c) return [];
    const result: SearchResult = { source: "tmdb", externalId: c.externalId, kind: c.kind, name: c.name };
    if (c.originalName && c.originalName !== c.name) result.originalName = c.originalName;
    if (c.originalLanguage) result.originalLanguage = c.originalLanguage;
    if (c.year) result.year = c.year;
    if (c.posterPath) result.imageUrl = tmdbImageUrl(c.posterPath, "w342");
    const votes = isObject(raw) ? count(raw.vote_count) : undefined;
    if (votes) result.votes = votes;
    const popularity = isObject(raw) && typeof raw.popularity === "number" ? raw.popularity : 0;
    return [{ result, popularity }];
  });
}

/** `/movie/{id}` or `/tv/{id}` → the `titles` row we cache. */
export function normalizeTmdbDetails(kind: TmdbKind, body: unknown): Title | null {
  const c = common(body, kind);
  if (!c || !isObject(body)) return null;

  const genres = Array.isArray(body.genres)
    ? body.genres.flatMap((g) => (isObject(g) && text(g.name) ? [text(g.name)!] : []))
    : [];

  let runtimeMin: number | undefined;
  if (kind === "movie") {
    runtimeMin = count(body.runtime) || undefined; // TMDB uses 0 for "unknown"
  } else {
    const perEpisode = Array.isArray(body.episode_run_time) ? count(body.episode_run_time[0]) : undefined;
    const last = isObject(body.last_episode_to_air) ? count(body.last_episode_to_air.runtime) : undefined;
    runtimeMin = perEpisode || last || undefined;
  }

  return {
    source: "tmdb",
    externalId: c.externalId,
    kind,
    name: c.name,
    originalName: c.originalName ?? null,
    originalLanguage: c.originalLanguage ?? null,
    year: c.year ?? null,
    posterPath: c.posterPath ?? null,
    genres,
    runtimeMin: runtimeMin ?? null,
    episodeCount: kind === "series" ? (count(body.number_of_episodes) ?? null) : null,
    seasonCount: kind === "series" ? (count(body.number_of_seasons) ?? null) : null,
    pageCount: null,
    chapterCount: null,
    volumeCount: null,
    playtimeHours: null,
    platforms: [],
  };
}

/** Numbered seasons of a `/tv/{id}` body that have episodes (specials, season 0, are skipped). */
export function tmdbSeasonNumbers(body: unknown): number[] {
  if (!isObject(body) || !Array.isArray(body.seasons)) return [];
  const seasons = body.seasons.flatMap((s) => {
    if (!isObject(s)) return [];
    const n = count(s.season_number);
    return n && n > 0 && (count(s.episode_count) ?? 1) > 0 ? [n] : [];
  });
  return [...new Set(seasons)].sort((a, b) => a - b);
}

/** Whether a `/tv/{id}` body says no more episodes are coming (the "Finished the series?" prompt). */
export function tmdbSeriesEnded(body: unknown): boolean {
  return isObject(body) && (body.status === "Ended" || body.status === "Canceled");
}

/** `/tv/{id}/season/{n}` → its episodes, in order. */
export function normalizeTmdbSeason(body: unknown): Episode[] {
  if (!isObject(body) || !Array.isArray(body.episodes)) return [];
  const season = count(body.season_number);
  if (!season) return [];
  const episodes = body.episodes.flatMap((e): Episode[] => {
    if (!isObject(e)) return [];
    const episode = count(e.episode_number);
    if (episode === undefined || count(e.season_number) !== season) return [];
    const airDate = text(e.air_date);
    return [
      {
        season,
        episode,
        name: text(e.name) ?? null,
        runtimeMin: count(e.runtime) || null,
        airDate: airDate && /^\d{4}-\d{2}-\d{2}$/.test(airDate) ? airDate : null,
      },
    ];
  });
  return episodes.sort((a, b) => a.episode - b.episode);
}
