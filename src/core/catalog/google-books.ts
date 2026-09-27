// Normalizes Google Books v1 JSON (`/volumes?q=` and `/volumes/{id}`). Input is untrusted: every field is checked,
// and unusable items are dropped. Covers go through our proxy (`bookCoverPath`): Google serves them without CORS.
import { bookCoverPath } from "./images";
import type { SearchResult, Title } from "./types";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
const ID_RE = /^[A-Za-z0-9_-]{12}$/;

type Volume = {
  externalId: string;
  name: string;
  author?: string;
  language?: string;
  year?: number;
  hasCover: boolean;
  genres: string[];
  pageCount?: number;
};

function volume(raw: unknown): Volume | null {
  if (!isObject(raw) || !isObject(raw.volumeInfo)) return null;
  const info = raw.volumeInfo;
  const externalId = typeof raw.id === "string" && ID_RE.test(raw.id) ? raw.id : undefined;
  const name = text(info.title);
  if (!externalId || !name || info.maturityRating === "MATURE") return null;
  const year = Number(text(info.publishedDate)?.match(/^(\d{4})/)?.[1]);
  const pages = info.pageCount;
  // "Fiction / Science Fiction / Space Opera" → Fiction, Science Fiction, Space Opera.
  const genres = Array.isArray(info.categories)
    ? [...new Set(info.categories.flatMap((c) => (text(c) ?? "").split("/").map((s) => s.trim())))].filter((g) => g && g !== "General")
    : [];
  const language = text(info.language);
  return {
    externalId,
    name,
    author: Array.isArray(info.authors) ? text(info.authors[0]) : undefined,
    language: language && /^[a-z]{2,3}(-[A-Za-z]{2})?$/.test(language) ? language.slice(0, 2) : undefined,
    year: year >= 1000 && year <= 2200 ? year : undefined,
    hasCover: isObject(info.imageLinks) && !!(text(info.imageLinks.thumbnail) || text(info.imageLinks.smallThumbnail)),
    genres: genres.slice(0, 3),
    pageCount: typeof pages === "number" && Number.isInteger(pages) && pages > 0 && pages <= 100_000 ? pages : undefined,
  };
}

/** `/volumes?q=` → results, in Google's relevance order. */
export function normalizeGoogleBooksSearch(body: unknown): SearchResult[] {
  if (!isObject(body) || !Array.isArray(body.items)) return [];
  const seen = new Set<string>();
  return body.items.flatMap((raw) => {
    const v = volume(raw);
    if (!v || seen.has(v.externalId)) return [];
    seen.add(v.externalId);
    const result: SearchResult = { source: "google_books", externalId: v.externalId, kind: "book", name: v.name };
    if (v.language) result.originalLanguage = v.language;
    if (v.year) result.year = v.year;
    if (v.hasCover) result.imageUrl = bookCoverPath(v.externalId);
    if (v.author) result.creator = v.author;
    return [result];
  });
}

/** `/volumes/{id}` → the `titles` row we cache. The page count is sometimes missing (null). */
export function normalizeGoogleBooksDetails(body: unknown): Title | null {
  const v = volume(body);
  if (!v) return null;
  return {
    source: "google_books",
    externalId: v.externalId,
    kind: "book",
    name: v.name,
    originalName: null,
    originalLanguage: v.language ?? null,
    year: v.year ?? null,
    // The volume id: covers are served by our proxy from it.
    posterPath: v.hasCover ? v.externalId : null,
    genres: v.genres,
    runtimeMin: null,
    episodeCount: null,
    seasonCount: null,
    pageCount: v.pageCount ?? null,
    chapterCount: null,
    volumeCount: null,
  };
}
