// Server-side TMDB v3 client. Only route handlers call this; the token never reaches the browser.
import {
  mergeTmdbSearch,
  normalizeTmdbDetails,
  normalizeTmdbList,
  normalizeTmdbSeason,
  tmdbMediaType,
  type TmdbKind,
} from "@/core/catalog/tmdb";
import type { Episode, SearchResult, Title } from "@/core/catalog/types";
import type { ReelCandidate } from "@/core/reel";
import { normalizeTmdbWatchProviders, type WatchProviders } from "@/core/catalog/watch-providers";
import { CatalogError } from "./catalog-error";

const API = "https://api.themoviedb.org/3";

export class TmdbError extends CatalogError {}

async function tmdb(path: string, params: Record<string, string>, revalidate: number): Promise<unknown> {
  const token = process.env.TMDB_API_TOKEN;
  if (!token) throw new TmdbError("TMDB_API_TOKEN is not set", 503);
  const url = new URL(API + path);
  // English titles for every locale in stage 0: TMDB falls back to the original-language
  // title (e.g. Korean) when a translation is missing, which reads worse than English.
  url.search = new URLSearchParams({ language: "en-US", ...params }).toString();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    next: { revalidate },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new TmdbError(`TMDB ${path} responded ${res.status}`, res.status === 404 ? 404 : 502);
  return res.json();
}

const DAY = 86_400;

export async function searchTitles(query: string): Promise<SearchResult[]> {
  const params = { query, include_adult: "false", page: "1" };
  const [movies, series] = await Promise.all([
    tmdb("/search/movie", params, DAY),
    tmdb("/search/tv", params, DAY),
  ]);
  return mergeTmdbSearch(movies, series);
}

/** Movies only, in TMDB's order, optionally first released in `year` (the Letterboxd import's matching). */
export async function searchMovies(query: string, year: number | null): Promise<SearchResult[]> {
  const params: Record<string, string> = { query, include_adult: "false", page: "1" };
  if (year !== null) params.primary_release_year = String(year);
  return normalizeTmdbList(await tmdb("/search/movie", params, DAY), "movie");
}

/** Series only, in TMDB's order, optionally first aired in `year` (the TV Time and MyAnimeList imports). */
export async function searchSeries(query: string, year: number | null): Promise<SearchResult[]> {
  const params: Record<string, string> = { query, include_adult: "false", page: "1" };
  if (year !== null) params.first_air_date_year = String(year);
  return normalizeTmdbList(await tmdb("/search/tv", params, DAY), "series");
}

/** The series TMDB knows under a TheTVDB id (`/find`; the TV Time import). */
export async function seriesByTvdb(tvdbId: string): Promise<SearchResult[]> {
  const body = await tmdb(`/find/${tvdbId}`, { external_source: "tvdb_id" }, DAY);
  const results = typeof body === "object" && body !== null ? (body as { tv_results?: unknown }).tv_results : undefined;
  return normalizeTmdbList({ results: Array.isArray(results) ? results : [] }, "series");
}

export async function trendingTitles(): Promise<SearchResult[]> {
  return normalizeTmdbList(await tmdb("/trending/all/week", {}, 3600));
}

/**
 * Details plus the raw body (kept in `titles.raw`, e.g. for `imdb_id`), with the credits and external ids in the same
 * request (`append_to_response`, no extra call; `saveTitle` keeps the credits in `titles.credits`, ADR 0047; a series'
 * IMDb id is only under `external_ids`, ADR 0058).
 */
export async function titleDetails(kind: TmdbKind, externalId: string): Promise<{ title: Title; raw: unknown } | null> {
  const raw = await tmdb(`/${tmdbMediaType(kind)}/${externalId}`, { append_to_response: "credits,external_ids" }, DAY);
  const title = normalizeTmdbDetails(kind, raw);
  return title ? { title, raw } : null;
}

/** Episodes of one season of a series (`/tv/{id}/season/{n}`). */
export async function seasonEpisodes(externalId: string, season: number): Promise<Episode[]> {
  return normalizeTmdbSeason(await tmdb(`/tv/${externalId}/season/${season}`, {}, DAY));
}

/**
 * Where a movie or series streams, every country at once (`/{movie|tv}/{id}/watch/providers`, data by JustWatch).
 * Next's fetch cache keeps it only an hour: our own cache (`title_providers`) is what keeps it a day.
 */
export async function watchProviders(kind: TmdbKind, externalId: string): Promise<WatchProviders> {
  return normalizeTmdbWatchProviders(await tmdb(`/${tmdbMediaType(kind)}/${externalId}/watch/providers`, {}, 3600));
}

/**
 * One page (20) of Reel of the Day's pool (stage 4, ADR 0048): the best-known movies by TMDB votes, no documentaries
 * or TV movies. Cached a week: the order barely moves.
 */
export async function reelPoolPage(page: number): Promise<ReelCandidate[]> {
  const params = {
    sort_by: "vote_count.desc",
    include_adult: "false",
    "vote_count.gte": "3000",
    without_genres: "99,10770",
    page: String(page),
  };
  return normalizeTmdbList(await tmdb("/discover/movie", params, 7 * DAY), "movie").map((r) => ({ externalId: r.externalId, hasPoster: !!r.imageUrl }));
}
