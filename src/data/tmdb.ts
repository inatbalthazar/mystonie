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

const API = "https://api.themoviedb.org/3";

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

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

export async function trendingTitles(): Promise<SearchResult[]> {
  return normalizeTmdbList(await tmdb("/trending/all/week", {}, 3600));
}

/** Details plus the raw body (kept in `titles.raw`, e.g. for `imdb_id`). */
export async function titleDetails(kind: TmdbKind, externalId: string): Promise<{ title: Title; raw: unknown } | null> {
  const raw = await tmdb(`/${tmdbMediaType(kind)}/${externalId}`, {}, DAY);
  const title = normalizeTmdbDetails(kind, raw);
  return title ? { title, raw } : null;
}

/** Episodes of one season of a series (`/tv/{id}/season/{n}`). */
export async function seasonEpisodes(externalId: string, season: number): Promise<Episode[]> {
  return normalizeTmdbSeason(await tmdb(`/tv/${externalId}/season/${season}`, {}, DAY));
}
