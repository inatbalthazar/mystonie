// "All" search (S2 books & manga, S3 games): TMDB, AniList, Google Books and RAWG results in one list. Their
// popularity numbers aren't comparable, so the merge ranks by how well the name matches the query, then takes the
// catalogs in turns.
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

/** "Baldur's Gate III" → ["baldur", "s", "gate", "iii"]: the words `searchKey` leaves. */
export const searchWords = (text: string): string[] => searchKey(text).split(" ").filter(Boolean);

/** Whether a name has every word of a query (`searchWords`); the last one may be the start of a word (still typing). */
export function hasEveryWord(name: string, query: readonly string[]): boolean {
  const own = searchWords(name);
  return query.length > 0 && query.every((word, i) => own.includes(word) || (i === query.length - 1 && own.some((w) => w.startsWith(word))));
}

const names = (result: SearchResult) => [result.name, result.originalName].filter((n): n is string => !!n);

/** 0 = the name is the query, 1 = it starts with it, 2 = anything else the catalog matched. */
function matchTier(result: SearchResult, query: string): number {
  const keys = names(result).map(searchKey);
  if (keys.some((n) => n === query)) return 0;
  if (keys.some((n) => n.startsWith(`${query} `) || n.startsWith(query))) return 1;
  return 2;
}

/**
 * Merges each catalog's results (in their own relevance order) for `query`: exact names first, then names that start
 * with the query, then the rest; within a tier the catalogs take turns, in the order given. So "one piece" shows the
 * TMDB series and the AniList manga side by side at the top. A catalog's own first pick ranks with the names that
 * start with the query when its name has every word of it, so the other catalogs' exact and prefix names can't bury
 * it: for "zelda", the movies called Zelda and the manga Zelda no Densetsu came before every game.
 */
export function mergeSearch(query: string, lists: readonly (readonly SearchResult[])[], limit = 20): SearchResult[] {
  const q = searchKey(query);
  const words = searchWords(query);
  const seen = new Set<string>();
  const ranked = lists.flatMap((list, source) =>
    list.map((result, rank) => {
      const tier = matchTier(result, q);
      const lead = rank === 0 && tier === 2 && names(result).some((n) => hasEveryWord(n, words));
      return { result, rank, source, tier: lead ? 1 : tier };
    }),
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
