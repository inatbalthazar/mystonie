// Finds an imported title in its catalog (S2 Letterboxd import, ADR 0033; S3 import & export, ADR 0041). Films and
// shows by name + year on TMDB, books by ISBN (else title and author) on Google Books, MyAnimeList entries through
// AniList's MyAnimeList ids. The rules only absorb punctuation, accents, release-year drift of a year, sequels'
// season markers and namesakes; anything uncertain becomes a question in the preview, never a guess.
import type { SearchResult, TitleKind } from "../catalog/types";

/** A title to find by name: what the export says. `aliases` are other names it goes by (an anime's romaji). */
export type FilmQuery = { name: string; year: number | null; aliases?: readonly string[] };

/** What the preview shows for a title: found, a choice for the user, or nothing. */
export type FilmMatch =
  | { state: "matched"; match: SearchResult }
  | { state: "ambiguous"; candidates: SearchResult[] }
  | { state: "missing" };

/** At most this many choices for an ambiguous title. */
export const MATCH_CANDIDATES = 5;

/** A TMDB search of one kind, optionally only titles first released in `year`. */
export type MovieSearch = (query: string, year: number | null) => Promise<SearchResult[]>;
export type SeriesSearch = MovieSearch;
/** Google Books `q=` search. */
export type BookSearch = (query: string) => Promise<SearchResult[]>;
/** TMDB's `/find` by TheTVDB id: the series it knows under that id. */
export type TvdbFind = (tvdbId: string) => Promise<SearchResult[]>;

/** Case, accents, punctuation, "&" vs "and" and spacing don't matter when comparing names. */
export function normalizeTitle(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .normalize("NFC"); // Hangul and the like, decomposed above, back together
}

const sameName = (query: FilmQuery, r: SearchResult) => {
  const wanted = new Set([query.name, ...(query.aliases ?? [])].map(normalizeTitle));
  return wanted.has(normalizeTitle(r.name)) || (r.originalName !== undefined && wanted.has(normalizeTitle(r.originalName)));
};

/**
 * Among namesakes, the one title far better known than all the others (a feature vs. a student short of the same
 * name and year), else null. People log the title everybody knows; the rare other case is fixed in the collection.
 */
export const FAMOUS_VOTES = 100;
export const FAMOUS_RATIO = 20;
function famous(list: readonly SearchResult[]): SearchResult | null {
  const [top, next] = [...list].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
  const votes = top?.votes ?? 0;
  return top && votes >= FAMOUS_VOTES && votes >= FAMOUS_RATIO * (next?.votes ?? 0) ? top : null;
}

/** One search's verdict, or null when it can't decide. */
function decide(query: FilmQuery, results: readonly SearchResult[], yearFiltered: boolean): FilmMatch | null {
  const named = results.filter((r) => sameName(query, r));
  const pick = (list: SearchResult[]): FilmMatch | null => {
    if (list.length === 0) return null;
    const one = list.length === 1 ? list[0]! : famous(list);
    return one ? { state: "matched", match: one } : { state: "ambiguous", candidates: list.slice(0, MATCH_CANDIDATES) };
  };
  if (query.year === null) return pick(named);
  const exact = pick(named.filter((r) => r.year === query.year));
  if (exact) return exact;
  // Release years drift between databases by a year (festival premiere vs. theatrical release).
  const near = pick(named.filter((r) => r.year !== undefined && Math.abs(r.year - query.year!) <= 1));
  if (near) return near;
  // The only title the catalog finds by that name first released that year, under another title (a translation).
  if (yearFiltered && results.length === 1 && results[0]!.year === query.year) return { state: "matched", match: results[0]! };
  return null;
}

/**
 * Matches one title by name on TMDB: a search limited to its year, then (when that can't decide) one without, for
 * each name it goes by until one decides. Anything found but not certain becomes a choice; nothing found at all
 * is "missing".
 */
async function matchByName(query: FilmQuery, kind: TitleKind, search: MovieSearch): Promise<FilmMatch> {
  const ofKind = async (name: string, year: number | null) => (await search(name, year)).filter((r) => r.kind === kind);
  const found: SearchResult[] = [];
  // Two names at most (an anime's English and romanized ones): each is a search or two.
  const names = [...new Set([query.name, ...(query.aliases ?? [])])].slice(0, 2);
  for (const name of names) {
    const byYear = query.year === null ? [] : await ofKind(name, query.year);
    const first = query.year === null ? null : decide(query, byYear, true);
    if (first) return first;
    const any = await ofKind(name, null);
    const second = decide(query, any, false);
    if (second) return second;
    found.push(...byYear, ...any);
  }
  const seen = new Set<string>();
  const candidates = found.filter((r) => !seen.has(r.externalId) && seen.add(r.externalId));
  return candidates.length ? { state: "ambiguous", candidates: candidates.slice(0, MATCH_CANDIDATES) } : { state: "missing" };
}

/** A film (Letterboxd, TV Time). Movies only. */
export function matchFilm(film: FilmQuery, search: MovieSearch): Promise<FilmMatch> {
  return matchByName(film, "movie", search);
}

/**
 * A show (TV Time): by TheTVDB id first (TMDB's `/find`), trusted when the name agrees, else by name like a film.
 */
export async function matchShow(show: FilmQuery & { tvdbId: string | null }, search: SeriesSearch, find: TvdbFind): Promise<FilmMatch> {
  if (show.tvdbId) {
    const found = (await find(show.tvdbId)).filter((r) => r.kind === "series" && sameName(show, r));
    if (found.length === 1) return { state: "matched", match: found[0]! };
  }
  return matchByName(show, "series", search);
}

const lastName = (author: string) => author.replace(/[",]/g, " ").trim().split(/\s+/).pop() ?? author;
/** "Dune: Deluxe Edition" and "Dune" are the same book here. */
const mainTitle = (name: string) => normalizeTitle(name.split(/[:(]/)[0]!);

/**
 * A book (Goodreads): its ISBN names the book outright (any edition will do). Otherwise a title + author search:
 * books of that title by that author are editions of one book, and Google's most relevant is taken; different
 * authors, or no title that agrees, make it a question.
 */
export async function matchBook(book: { name: string; author: string | null; isbn: string | null }, search: BookSearch): Promise<FilmMatch> {
  const books = async (q: string) => (await search(q)).filter((r) => r.kind === "book");
  if (book.isbn) {
    const [found] = await books(`isbn:${book.isbn}`);
    if (found) return { state: "matched", match: found };
  }
  const title = book.name.replace(/"/g, "");
  const results = await books(book.author ? `intitle:"${title}" inauthor:"${lastName(book.author)}"` : `intitle:"${title}"`);
  const want = mainTitle(book.name);
  const surname = book.author ? normalizeTitle(lastName(book.author)) : null;
  const named = results.filter(
    (r) => mainTitle(r.name) === want && (!surname || !r.creator || normalizeTitle(r.creator).split(" ").includes(surname)),
  );
  const authors = new Set(named.map((r) => normalizeTitle(r.creator ?? "")));
  if (named.length > 0 && (authors.size === 1 || surname)) return { state: "matched", match: named[0]! };
  const candidates = (named.length ? named : results).slice(0, MATCH_CANDIDATES);
  return candidates.length ? { state: "ambiguous", candidates } : { state: "missing" };
}

/** What AniList knows about a MyAnimeList anime: its names, format and year (the TMDB search needs them). */
export type AnimeInfo = { format: string | null; names: string[]; year: number | null };

/** "Attack on Titan Season 2", "…: The Final Season", "進撃の巨人 第2期" → "Attack on Titan": TMDB has one series. */
export function withoutSeason(name: string): string {
  return name
    .replace(/\s*[:\-–]?\s*(the\s+)?final\s+season\b.*$/i, "")
    .replace(/\s*[:\-–]?\s*(season|part|cour)\s*\d+\b.*$/i, "")
    .replace(/\s*[:\-–]?\s*\d+(st|nd|rd|th)\s+season\b.*$/i, "")
    .replace(/\s*第\s*\d+\s*期.*$/, "")
    .replace(/\s+(II|III|IV|V|VI)$/, "")
    .trim();
}

/**
 * An anime from MyAnimeList: films on TMDB's movies, the rest on its series, by AniList's English and romanized
 * names (and the Japanese one, which TMDB keeps as the original name). A sequel season is found as its series: the
 * season marker goes, and so does the year (the series started earlier). Without AniList's help, MyAnimeList's
 * own title and type are all there is.
 */
export function matchAnime(
  anime: AnimeInfo | null,
  fallback: { name: string; find: "movie" | "series" | "screen" },
  searches: { movies: MovieSearch; series: SeriesSearch },
): Promise<FilmMatch> {
  const names = anime?.names.length ? anime.names : [fallback.name];
  const bases = [...new Set(names.map(withoutSeason).filter(Boolean))];
  const sequel = bases.length > 0 && names.some((n) => withoutSeason(n) !== n.trim());
  const movie = anime ? anime.format === "MOVIE" : fallback.find === "movie";
  const query: FilmQuery = { name: bases[0] ?? fallback.name, year: sequel ? null : (anime?.year ?? null), aliases: bases.slice(1) };
  return movie ? matchByName(query, "movie", searches.movies) : matchByName(query, "series", searches.series);
}
