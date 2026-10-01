// Normalizes AniList GraphQL responses (manga, manhwa, manhua, webtoons). Input is untrusted: every field is checked,
// and unusable items are dropped. Adult titles and light novels (format NOVEL) are left out: novels are books.
import { isAnilistCover } from "./images";
import type { SearchResult, Title } from "./types";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
const count = (v: unknown): number | undefined => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : undefined);

const MEDIA_FIELDS = `id format isAdult countryOfOrigin genres chapters volumes
  title { english romaji native } startDate { year } coverImage { large extraLarge }`;

/** Manga search, best match first. `$q` is the query. */
export const ANILIST_SEARCH_QUERY = `query ($q: String) {
  Page(perPage: 20) {
    media(search: $q, type: MANGA, isAdult: false, format_in: [MANGA, ONE_SHOT], sort: [SEARCH_MATCH, POPULARITY_DESC]) { ${MEDIA_FIELDS} }
  }
}`;

/**
 * Titles by MyAnimeList id (`$ids`, ≤ 50; `$type` ANIME or MANGA), for the MyAnimeList import (ADR 0041): manga
 * are ours on AniList, anime give their names, format and year for the TMDB search.
 */
export const ANILIST_BY_MAL_QUERY = `query ($ids: [Int], $type: MediaType) {
  Page(perPage: 50) { media(idMal_in: $ids, type: $type) { idMal ${MEDIA_FIELDS} } }
}`;

/** One manga by AniList id (`$id`), with the staff who wrote and drew it (`anilistCredits`). */
export const ANILIST_DETAILS_QUERY = `query ($id: Int) {
  Media(id: $id, type: MANGA) { ${MEDIA_FIELDS} staff(sort: [RELEVANCE, ID], perPage: 8) { edges { role node { id name { full } image { medium } } } } }
}`;

const FORMATS = new Set(["MANGA", "ONE_SHOT"]);

/** AniList's `countryOfOrigin` (ISO 3166) as the original language (ISO 639-1). */
const LANGUAGE_BY_COUNTRY: Record<string, string> = { JP: "ja", KR: "ko", CN: "zh", TW: "zh", HK: "zh" };

type Media = {
  externalId: string;
  name: string;
  originalName?: string;
  originalLanguage?: string;
  year?: number;
  cover?: string;
  largeCover?: string;
  genres: string[];
  chapters?: number;
  volumes?: number;
};

function media(raw: unknown): Media | null {
  if (!isObject(raw) || raw.isAdult === true || !FORMATS.has(raw.format as string)) return null;
  const externalId = typeof raw.id === "number" && Number.isInteger(raw.id) && raw.id > 0 ? String(raw.id) : undefined;
  const title = isObject(raw.title) ? raw.title : {};
  // English first, like TMDB's en-US titles (ADR 0012); the romanized title when there's no English one.
  const name = text(title.english) ?? text(title.romaji) ?? text(title.native);
  if (!externalId || !name) return null;
  const native = text(title.native);
  const year = isObject(raw.startDate) ? count(raw.startDate.year) : undefined;
  const cover = isObject(raw.coverImage) ? raw.coverImage : {};
  const url = (v: unknown) => {
    const u = text(v);
    return u && isAnilistCover(u) ? u : undefined;
  };
  return {
    externalId,
    name,
    originalName: native && native !== name ? native : undefined,
    originalLanguage: LANGUAGE_BY_COUNTRY[raw.countryOfOrigin as string],
    year: year && year >= 1800 && year <= 2200 ? year : undefined,
    cover: url(cover.large),
    largeCover: url(cover.extraLarge) ?? url(cover.large),
    genres: Array.isArray(raw.genres) ? raw.genres.flatMap((g) => (text(g) ? [text(g)!] : [])).slice(0, 5) : [],
    chapters: count(raw.chapters),
    volumes: count(raw.volumes),
  };
}

function result(m: Media): SearchResult {
  const r: SearchResult = { source: "anilist", externalId: m.externalId, kind: "manga", name: m.name };
  if (m.originalName) r.originalName = m.originalName;
  if (m.originalLanguage) r.originalLanguage = m.originalLanguage;
  if (m.year) r.year = m.year;
  if (m.cover) r.imageUrl = m.cover;
  return r;
}

const pageMedia = (body: unknown): unknown[] => {
  const page = isObject(body) && isObject(body.data) && isObject(body.data.Page) ? body.data.Page : null;
  return page && Array.isArray(page.media) ? page.media : [];
};

/** `Page.media` of a search → results. */
export function normalizeAnilistSearch(body: unknown): SearchResult[] {
  return pageMedia(body).flatMap((raw) => {
    const m = media(raw);
    return m ? [result(m)] : [];
  });
}

/** An anime as the MyAnimeList import needs it: its names (English, romanized, Japanese), format and year. */
export type AnilistAnime = { format: string | null; names: string[]; year: number | null };

/**
 * `ANILIST_BY_MAL_QUERY`'s answer, by MyAnimeList id: manga as search results (adult ones and novels left out, as
 * everywhere), anime as names to search TMDB with.
 */
export function normalizeAnilistByMal(body: unknown): { manga: Map<number, SearchResult>; anime: Map<number, AnilistAnime> } {
  const manga = new Map<number, SearchResult>();
  const anime = new Map<number, AnilistAnime>();
  for (const raw of pageMedia(body)) {
    if (!isObject(raw) || typeof raw.idMal !== "number" || !Number.isInteger(raw.idMal)) continue;
    const m = media(raw);
    if (m) {
      manga.set(raw.idMal, result(m));
      continue;
    }
    if (raw.isAdult === true || FORMATS.has(raw.format as string) || raw.format === "NOVEL") continue;
    const title = isObject(raw.title) ? raw.title : {};
    const names = [...new Set([text(title.english), text(title.romaji), text(title.native)].filter((n): n is string => !!n))];
    const year = isObject(raw.startDate) ? count(raw.startDate.year) : undefined;
    if (names.length) anime.set(raw.idMal, { format: text(raw.format) ?? null, names, year: year ?? null });
  }
  return { manga, anime };
}

/** `Media` → the `titles` row we cache. Chapters and volumes stay null while a series is running. */
export function normalizeAnilistDetails(body: unknown): Title | null {
  const raw = isObject(body) && isObject(body.data) ? body.data.Media : null;
  const m = media(raw);
  if (!m) return null;
  return {
    source: "anilist",
    externalId: m.externalId,
    kind: "manga",
    name: m.name,
    originalName: m.originalName ?? null,
    originalLanguage: m.originalLanguage ?? null,
    year: m.year ?? null,
    posterPath: m.largeCover ?? null,
    genres: m.genres,
    runtimeMin: null,
    episodeCount: null,
    seasonCount: null,
    pageCount: null,
    chapterCount: m.chapters ?? null,
    volumeCount: m.volumes ?? null,
    playtimeHours: null,
    platforms: [],
  };
}
