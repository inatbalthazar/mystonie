// Poster URLs for every catalog. Cards render in the browser and export through a canvas, so every poster must be
// served with CORS: TMDB, AniList and RAWG images are; Google Books covers aren't, so they go through our own
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
const SMALL_SIZES: readonly TmdbImageSize[] = ["w92", "w154", "w185"];

// RAWG (games, ADR 0044): landscape key art (1920 × 1080), `games/…` or `screenshots/…` under media.rawg.io/media/.
const RAWG_MEDIA = "https://media.rawg.io/media/";
const RAWG_PATH = String.raw`(games|screenshots)/[0-9a-f]{3}/[0-9a-f]{32}(_[A-Za-z0-9]{1,16})?\.(jpg|jpeg|png|webp)`;
const RAWG_PATH_RE = new RegExp(`^${RAWG_PATH}$`);
const RAWG_URL_RE = new RegExp(`^https://media\\.rawg\\.io/media/(resize/(420|640|1280)/-/)?(${RAWG_PATH})$`);

/** RAWG's widths that come ready-made (any other redirects to a slow resize on their API host, checked 2026-09-30). */
export type RawgWidth = 420 | 640 | 1280;

/** The media path of a RAWG image URL (`games/618/618c….jpg`), or null for anything else. */
export function rawgMediaPath(url: string): string | null {
  const match = RAWG_URL_RE.exec(url);
  return match ? match[3]! : null;
}

export const isRawgMediaPath = (path: string) => RAWG_PATH_RE.test(path);

/** A RAWG image `width` px wide (the height follows: 16:9 key art is 236, 360 or 720 px tall). */
export const rawgImageUrl = (path: string, width: RawgWidth) => `${RAWG_MEDIA}resize/${width}/-/${path}`;

/**
 * A poster URL from a `titles.poster_path`: a TMDB path at `size`, an AniList cover URL as stored, our proxy for a
 * Google Books volume id, or a RAWG image wide enough for `size` (landscape art is cropped into portrait slots, so
 * it needs the height). Null for anything else.
 */
export function posterUrl(source: CatalogSource | string, path: string | null | undefined, size: TmdbImageSize = "w342"): string | null {
  if (!path) return null;
  if (source === "tmdb") return path.startsWith("/") ? tmdbImageUrl(path, size) : null;
  if (source === "anilist") return isAnilistCover(path) ? path : null;
  if (source === "google_books") return BOOK_ID_RE.test(path) ? bookCoverPath(path, LARGE_SIZES.includes(size)) : null;
  if (source === "rawg") return isRawgMediaPath(path) ? rawgImageUrl(path, SMALL_SIZES.includes(size) ? 420 : LARGE_SIZES.includes(size) ? 1280 : 640) : null;
  return null;
}

// Only catalog images: a card link must not be able to show an arbitrary picture under our name.
const TMDB_POSTER_RE = /^https:\/\/image\.tmdb\.org\/t\/p\/w\d{2,4}\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/;
const BOOK_COVER_RE = /^\/api\/covers\/[A-Za-z0-9_-]{12}(\?size=large)?$/;

/**
 * The image a card draws for a poster URL, as big as a card shows it: TMDB's poster at w780, AniList's large cover,
 * RAWG's key art at 1280 px. Anything else as it is.
 *
 * It's also never the URL a list loads. TMDB's and AniList's CDNs send `Access-Control-Allow-Origin` only to requests
 * that ask for it, without `Vary: Origin`, so the copy a list loaded without CORS sits in the browser's cache and
 * fails the card's CORS request (no poster, no colours). Lists show AniList's large cover too, so the card's copy
 * carries `?card`.
 */
export function cardImageUrl(url: string): string {
  const path = rawgMediaPath(url);
  if (path) return rawgImageUrl(path, 1280);
  if (TMDB_POSTER_RE.test(url)) return url.replace(/\/t\/p\/w\d{2,4}\//, "/t/p/w780/");
  const anilist = ANILIST_COVER_RE.exec(url);
  return anilist ? `${url.replace(`/cover/${anilist[1]}/`, "/cover/large/")}?card` : url;
}

/** Whether a card may show this poster: a TMDB image, an AniList cover, our Google Books cover proxy or RAWG art. */
export function isCardPosterUrl(url: string): boolean {
  return TMDB_POSTER_RE.test(url) || ANILIST_COVER_RE.test(url) || BOOK_COVER_RE.test(url) || RAWG_URL_RE.test(url);
}
