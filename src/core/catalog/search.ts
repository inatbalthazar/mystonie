// "All" search (S2 books & manga): TMDB, AniList and Google Books results in one list. Their popularity numbers
// aren't comparable, so the merge ranks by how well the name matches the query, then takes the catalogs in turns.
import type { SearchResult } from "./types";

/** "ONE PIECE, Vol. 1" → "one piece vol 1": lower case, no accents or punctuation. */
export function searchKey(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** 0 = the name is the query, 1 = it starts with it, 2 = anything else the catalog matched. */
function matchTier(result: SearchResult, query: string): number {
  const names = [result.name, result.originalName].filter((n): n is string => !!n).map(searchKey);
  if (names.some((n) => n === query)) return 0;
  if (names.some((n) => n.startsWith(`${query} `) || n.startsWith(query))) return 1;
  return 2;
}

/**
 * Merges each catalog's results (in their own relevance order) for `query`: exact names first, then names that start
 * with the query, then the rest; within a tier the catalogs take turns, in the order given. So "one piece" shows the
 * TMDB series and the AniList manga side by side at the top.
 */
export function mergeSearch(query: string, lists: readonly (readonly SearchResult[])[], limit = 20): SearchResult[] {
  const q = searchKey(query);
  const seen = new Set<string>();
  const ranked = lists.flatMap((list, source) =>
    list.map((result, rank) => ({ result, rank, source, tier: matchTier(result, q) })),
  );
  return ranked
    .sort((a, b) => a.tier - b.tier || a.rank - b.rank || a.source - b.source)
    .filter(({ result }) => {
      const key = `${result.source}:${result.kind}:${result.externalId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map(({ result }) => result);
}
