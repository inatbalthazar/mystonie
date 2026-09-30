export type CatalogSource = "tmdb" | "google_books" | "anilist" | "rawg";

/** Every kind of title, in the order the app lists them. */
export const TITLE_KINDS = ["movie", "series", "book", "manga", "game"] as const;
export type TitleKind = (typeof TITLE_KINDS)[number];
export const isTitleKind = (v: unknown): v is TitleKind => (TITLE_KINDS as readonly unknown[]).includes(v);

/** Books and manga are read; movies and series are watched (the Collection's Read and Watch tabs). */
export type ReadingKind = "book" | "manga";
export const isReadingKind = (kind: TitleKind): kind is ReadingKind => kind === "book" || kind === "manga";

/** Movies and series: what TMDB has, and what's watched. */
export const isScreenKind = (kind: TitleKind): kind is "movie" | "series" => kind === "movie" || kind === "series";

/**
 * Where each kind comes from: TMDB for movies and series, Google Books for books, AniList for manga (ADR 0029), RAWG
 * for games (ADR 0044).
 */
export function sourceForKind(kind: TitleKind): CatalogSource {
  return kind === "book" ? "google_books" : kind === "manga" ? "anilist" : kind === "game" ? "rawg" : "tmdb";
}

/** Whether `id` looks like an id of `kind`'s catalog: numeric on TMDB, AniList and RAWG, 12 characters on Google Books. */
export function isExternalId(kind: TitleKind, id: unknown): id is string {
  if (typeof id !== "string") return false;
  return kind === "book" ? /^[A-Za-z0-9_-]{12}$/.test(id) : /^\d{1,10}$/.test(id);
}

/**
 * The search sheet's type switcher: All · Movies & TV · Books · Manga · Games. `screen` is the default (the card
 * maker).
 */
export const SEARCH_TYPES = ["all", "screen", "book", "manga", "game"] as const;
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
  /** A game's platform families ("PC", "PlayStation", …), to tell ports and namesakes apart. */
  platforms?: string[];
  /** TMDB's vote count: how well known a film is (the Letterboxd import tells namesakes apart with it). */
  votes?: number;
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
  /**
   * Provider-relative path (a Google Books volume id, a full AniList cover URL, a RAWG media path); build URLs with
   * `posterUrl`.
   */
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
  /** Games: RAWG's average playtime in hours (null while unknown). */
  playtimeHours: number | null;
  /** Games: the platform families it came out on ("PC", "PlayStation", …); empty for everything else. */
  platforms: string[];
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
