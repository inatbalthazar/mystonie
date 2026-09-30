// Taste filters shared by badges (S3 badges & shelf), monthly challenges and fandom clubs (S3 challenges & clubs):
// which titles count, by kind, genre and original language. Genres are compared in lower case as the catalogs
// (TMDB, AniList, Google Books) spell them; `club_feed` and `club_trending` in SQL compare the same way.
import type { TitleKind } from "./catalog/types";

/** Genre names as the catalogs spell them, lower case. */
export const GENRES = {
  horror: ["horror"],
  comedy: ["comedy", "humor", "humour"],
  scifi: ["science fiction", "sci-fi & fantasy", "sci-fi"],
  fantasy: ["fantasy", "sci-fi & fantasy"],
  romance: ["romance"],
  mystery: ["crime", "mystery", "mystery & detective", "thriller", "thrillers"],
  animation: ["animation"],
  documentary: ["documentary"],
} as const;

/** Titles that count: any of the kinds, any of the genres and any of the original languages given (absent = any). */
export type TitleFilter = { kinds?: readonly TitleKind[]; genres?: readonly string[]; languages?: readonly string[] };

export type TasteTitle = { kind: TitleKind; genres: readonly string[]; originalLanguage: string | null };

/** The title's genres, trimmed, lower case and without repeats. */
export const genreKeys = (genres: readonly string[]): string[] => [...new Set(genres.map((g) => g.trim().toLowerCase()).filter(Boolean))];

/** Whether the title passes every part of the filter. */
export function fitsFilter(filter: TitleFilter, title: TasteTitle, genres: readonly string[] = genreKeys(title.genres)): boolean {
  if (filter.kinds && !filter.kinds.includes(title.kind)) return false;
  if (filter.genres && !genres.some((g) => filter.genres!.includes(g))) return false;
  if (filter.languages && !(title.originalLanguage && filter.languages.includes(title.originalLanguage.toLowerCase()))) return false;
  return true;
}
