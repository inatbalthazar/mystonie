// Poster URLs for every catalog. Cards render in the browser and export through a canvas, so every poster must be
// served with CORS: TMDB and AniList images are; Google Books covers aren't, so they go through our own
// `/api/covers/[id]` (same origin, ADR 0029).
import { tmdbImageUrl, type TmdbImageSize } from "./tmdb";
import type { CatalogSource } from "./types";

/** AniList cover sizes live under `cover/small|medium|large/`. */
const ANILIST_COVER_RE = /^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/media\/manga\/cover\/(small|medium|large)\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|gif|webp)$/;
const BOOK_ID_RE = /^[A-Za-z0-9_-]{12}$/;

export const isAnilistCover = (url: string) => ANILIST_COVER_RE.test(url);

/** Our proxy path for a Google Books cover: 300 px wide, or 575 px `large`. */
export const bookCoverPath = (volumeId: string, large = false) => `/api/covers/${volumeId}${large ? "?size=large" : ""}`;

/** TMDB sizes that ask for a big poster (the card maker's w780) get the large book cover. */
const LARGE_SIZES: readonly TmdbImageSize[] = ["w500", "w780", "original"];

/**
 * A poster URL from a `titles.poster_path`: a TMDB path at `size`, an AniList cover URL as stored, or our proxy for a
 * Google Books volume id. Null for anything else.
 */
export function posterUrl(source: CatalogSource | string, path: string | null | undefined, size: TmdbImageSize = "w342"): string | null {
  if (!path) return null;
  if (source === "tmdb") return path.startsWith("/") ? tmdbImageUrl(path, size) : null;
  if (source === "anilist") return isAnilistCover(path) ? path : null;
  if (source === "google_books") return BOOK_ID_RE.test(path) ? bookCoverPath(path, LARGE_SIZES.includes(size)) : null;
  return null;
}

// Only catalog images: a card link must not be able to show an arbitrary picture under our name.
const TMDB_POSTER_RE = /^https:\/\/image\.tmdb\.org\/t\/p\/w\d{2,4}\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/;
const BOOK_COVER_RE = /^\/api\/covers\/[A-Za-z0-9_-]{12}(\?size=large)?$/;

/** Whether a card may show this poster: a TMDB image, an AniList cover or our Google Books cover proxy. */
export function isCardPosterUrl(url: string): boolean {
  return TMDB_POSTER_RE.test(url) || ANILIST_COVER_RE.test(url) || BOOK_COVER_RE.test(url);
}
