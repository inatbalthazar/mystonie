// One entry point over the catalogs (ADR 0029, ADR 0044): TMDB for movies and series, AniList for manga, Google Books for
// books, RAWG for games. Route handlers call these; the keys never reach the browser.
import { RAWG_ALL_RESULTS } from "@/core/catalog/rawg";
import { mergeSearch } from "@/core/catalog/search";
import type { SearchResult, SearchType, Title, TitleKind } from "@/core/catalog/types";
import { mangaDetails, searchManga } from "./anilist";
import { CatalogError } from "./catalog-error";
import { bookDetails, searchBooks } from "./google-books";
import { gameDetails, searchGames } from "./rawg";
import { searchTitles, titleDetails } from "./tmdb";

/** "All" asks RAWG only from this many characters: its free plan counts every request (20,000 a month). */
export const ALL_GAMES_MIN_CHARS = 3;

/** Details of a title from its kind's catalog, plus the raw body. Null when the catalog doesn't know it. */
export function catalogDetails(kind: TitleKind, externalId: string): Promise<{ title: Title; raw: unknown } | null> {
  if (kind === "book") return bookDetails(externalId);
  if (kind === "manga") return mangaDetails(externalId);
  if (kind === "game") return gameDetails(externalId);
  return titleDetails(kind, externalId);
}

/**
 * Search for the sheet's type switcher. `screen` (the default, also the card maker's) is TMDB only; `book`, `manga` and
 * `game` are one catalog each. `all` asks them all at once and merges them (`mergeSearch`; games from
 * `ALL_GAMES_MIN_CHARS`, the best known `RAWG_ALL_RESULTS` of them); a catalog that fails or isn't set up is left out,
 * and only when every one fails does the search fail.
 */
export async function searchCatalog(query: string, type: SearchType): Promise<SearchResult[]> {
  if (type === "screen") return searchTitles(query);
  if (type === "book") return searchBooks(query);
  if (type === "manga") return searchManga(query);
  if (type === "game") return searchGames(query);

  const games = query.length >= ALL_GAMES_MIN_CHARS ? [searchGames(query).then((list) => list.slice(0, RAWG_ALL_RESULTS))] : [];
  const settled = await Promise.allSettled([searchTitles(query), searchManga(query), searchBooks(query), ...games]);
  const lists = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const failures = settled.flatMap((r) => (r.status === "rejected" ? [r.reason as unknown] : []));
  for (const error of failures) {
    if (!(error instanceof CatalogError && error.status === 503)) console.warn("catalog search failed", error);
  }
  if (lists.length === 0) throw failures[0];
  return mergeSearch(query, lists);
}
