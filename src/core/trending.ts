// Trending (S3 finishers & the board, ADR 0039): what people on Mystonie finished, watched or read this week comes
// first, then TMDB's weekly list fills the rest, so the section works from day one and turns into our own as people
// arrive. Our own list is counts only, and a title needs at least 3 people (enforced in `trending_titles()`).
import { isExternalId, isTitleKind, type SearchResult, type TitleKind } from "./catalog/types";

/** A trending title; `people` is set when it comes from Mystonie's own logs (how many were on it this week). */
export type TrendingTitle = SearchResult & { people?: number };

const key = (t: Pick<SearchResult, "kind" | "externalId">) => `${t.kind}:${t.externalId}`;

/** Our own titles first (as ranked), then the world's, without repeats, at most `max`. */
export function blendTrending(own: readonly TrendingTitle[], world: readonly SearchResult[], max: number): TrendingTitle[] {
  const seen = new Set<string>();
  const out: TrendingTitle[] = [];
  for (const title of [...own, ...world]) {
    if (out.length >= max) break;
    if (seen.has(key(title))) continue;
    seen.add(key(title));
    out.push(title);
  }
  return out;
}

/** `?pick=<kind>:<id>` (a trending title tapped on Home) → the title to open quick add on, or null. */
export function parsePick(raw: unknown): { kind: TitleKind; externalId: string } | null {
  if (typeof raw !== "string") return null;
  const m = /^([a-z]+):(.+)$/.exec(raw);
  if (!m || !isTitleKind(m[1])) return null;
  const kind = m[1];
  return isExternalId(kind, m[2]) ? { kind, externalId: m[2]! } : null;
}
