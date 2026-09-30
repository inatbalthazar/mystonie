// Server-side AniList GraphQL client (manga). No key needed. AniList allows about 30 requests a minute per server
// (checked 2026-09-27: `X-RateLimit-Limit: 30`), so responses are cached hard in Next's fetch cache: its API only
// answers POST, which Next caches when asked to (`force-cache`).
import {
  ANILIST_BY_MAL_QUERY,
  ANILIST_DETAILS_QUERY,
  ANILIST_SEARCH_QUERY,
  normalizeAnilistByMal,
  normalizeAnilistDetails,
  normalizeAnilistSearch,
  type AnilistAnime,
} from "@/core/catalog/anilist";
import type { SearchResult, Title } from "@/core/catalog/types";
import { CatalogError } from "./catalog-error";

const API = "https://graphql.anilist.co";
const DAY = 86_400;

async function anilist(query: string, variables: Record<string, unknown>, revalidate: number): Promise<unknown> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "force-cache",
    next: { revalidate },
    signal: AbortSignal.timeout(8000),
  });
  // AniList answers 404 (with a JSON error) for an unknown id.
  if (res.status === 404) return null;
  if (!res.ok) throw new CatalogError(`AniList responded ${res.status}`, 502);
  return res.json();
}

export async function searchManga(query: string): Promise<SearchResult[]> {
  return normalizeAnilistSearch(await anilist(ANILIST_SEARCH_QUERY, { q: query }, DAY));
}

/** Details plus the raw body (kept in `titles.raw`). Null when AniList has no such manga (or it's adult or a novel). */
export async function mangaDetails(externalId: string): Promise<{ title: Title; raw: unknown } | null> {
  const raw = await anilist(ANILIST_DETAILS_QUERY, { id: Number(externalId) }, DAY);
  const title = normalizeAnilistDetails(raw);
  return title ? { title, raw } : null;
}

/** Anime or manga by MyAnimeList id (≤ 50 in one request; the MyAnimeList import). */
export async function anilistByMal(
  ids: readonly number[],
  type: "ANIME" | "MANGA",
): Promise<{ manga: Map<number, SearchResult>; anime: Map<number, AnilistAnime> }> {
  if (ids.length === 0) return { manga: new Map(), anime: new Map() };
  return normalizeAnilistByMal(await anilist(ANILIST_BY_MAL_QUERY, { ids: [...ids].sort((a, b) => a - b), type }, DAY));
}
