export type CatalogSource = "tmdb" | "google_books" | "anilist";
export type TitleKind = "movie" | "series" | "book" | "manga";

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
  /** Provider-relative path; build sized URLs with e.g. `tmdbImageUrl`. */
  posterPath: string | null;
  genres: string[];
  /** Movie runtime, or the typical episode runtime for a series. */
  runtimeMin: number | null;
  episodeCount: number | null;
  seasonCount: number | null;
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
