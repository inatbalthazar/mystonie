// Server-side RAWG v1 client (games, ADR 0044). The key stays on the server; without `RAWG_API_KEY` game search is off
// (RAWG answers 401 to keyless calls). The free plan allows 20,000 requests a month, so answers are cached a day in
// Next's fetch cache (queries arrive lower-cased), and "All" asks RAWG only from 3 characters (`searchCatalog`).
import { normalizeRawgDetails, normalizeRawgSearch, rawgSearchParams } from "@/core/catalog/rawg";
import type { SearchResult, Title } from "@/core/catalog/types";
import { CatalogError } from "./catalog-error";

const API = "https://api.rawg.io/api";
const DAY = 86_400;

async function rawg(path: string, params: Record<string, string>): Promise<unknown> {
  const key = process.env.RAWG_API_KEY;
  if (!key) throw new CatalogError("RAWG_API_KEY is not set", 503);
  const url = new URL(API + path);
  url.search = new URLSearchParams({ ...params, key }).toString();
  const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: DAY }, signal: AbortSignal.timeout(8000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new CatalogError(`RAWG ${path} responded ${res.status}`, 502);
  return res.json();
}

export async function searchGames(query: string): Promise<SearchResult[]> {
  return normalizeRawgSearch(await rawg("/games", rawgSearchParams(query)), query);
}

/** Details plus the raw body (kept in `titles.raw`, e.g. for the developers). Null when RAWG has no such game. */
export async function gameDetails(externalId: string): Promise<{ title: Title; raw: unknown } | null> {
  const raw = await rawg(`/games/${externalId}`, {});
  const title = normalizeRawgDetails(raw);
  return title ? { title, raw } : null;
}
