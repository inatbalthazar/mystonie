export type CatalogSource = "tmdb" | "google_books" | "anilist";
export type TitleKind = "movie" | "series" | "book" | "manga";

/** Books and manga are read; movies and series are watched (the Collection's Read and Watch tabs). */
export type ReadingKind = "book" | "manga";
export const isReadingKind = (kind: TitleKind): kind is ReadingKind => kind === "book" || kind === "manga";

/** Where each kind comes from: TMDB for movies and series, Google Books for books, AniList for manga (ADR 0029). */
export function sourceForKind(kind: TitleKind): CatalogSource {
  return kind === "book" ? "google_books" : kind === "manga" ? "anilist" : "tmdb";
}

/** Whether `id` looks like an id of `kind`'s catalog: numeric on TMDB and AniList, 12 characters on Google Books. */
export function isExternalId(kind: TitleKind, id: unknown): id is string {
  if (typeof id !== "string") return false;
  return kind === "book" ? /^[A-Za-z0-9_-]{12}$/.test(id) : /^\d{1,10}$/.test(id);
}

/** The search sheet's type switcher: All · Movies & TV · Books · Manga. `screen` is the default (the card maker). */
export const SEARCH_TYPES = ["all", "screen", "book", "manga"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
export const isSearchType = (v: unknown): v is SearchType => (SEARCH_TYPES as readonly unknown[]).includes(v);

/** One row in search results or the trending list. */
export type SearchResult = {
  source: CatalogSource;
  externalId: string;
  kind: TitleKind;
  name: string;
  originalName?: string;
  originalLanguage?: string;
  year?: number;
  /** Small poster, ready for a result list. */
  imageUrl?: string;
  /** A book's first author, to tell editions and namesakes apart. */
  creator?: string;
};

/** A picked title with the details a card needs. Mirrors the `titles` table. */
export type Title = {
  source: CatalogSource;
  externalId: string;
  kind: TitleKind;
  name: string;
  originalName: string | null;
  originalLanguage: string | null;
  year: number | null;
  /** Provider-relative path (a Google Books volume id, a full AniList cover URL); build URLs with `posterUrl`. */
  posterPath: string | null;
  genres: string[];
  /** Movie runtime, or the typical episode runtime for a series. */
  runtimeMin: number | null;
  episodeCount: number | null;
  seasonCount: number | null;
  /** Books: pages. Manga: chapters and volumes (null while unknown, e.g. still running). */
  pageCount: number | null;
  chapterCount: number | null;
  volumeCount: number | null;
};

/** One episode of a series. Mirrors the `title_episodes` table. Season 0 (specials) is not kept. */
export type Episode = {
  season: number;
  episode: number;
  name: string | null;
  runtimeMin: number | null;
  /** `YYYY-MM-DD`; null when TMDB doesn't know it yet. */
  airDate: string | null;
};
