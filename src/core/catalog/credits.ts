// Who made a title (stage 4 deeper stats, ADR 0047): the people and companies behind it, from each catalog's details
// body, kept in `titles.credits`. Input is untrusted: every field is checked, and unusable items are dropped.
import { tmdbImageUrl } from "./tmdb";
import type { CatalogSource, TitleKind } from "./types";

/**
 * Actors (top-billed cast), directors (a series' creators), studios (production companies), authors (books, and a
 * manga's story and art) and developers (games).
 */
export const CREDIT_ROLES = ["actor", "director", "studio", "author", "developer"] as const;
export type CreditRole = (typeof CREDIT_ROLES)[number];
export const isCreditRole = (v: unknown): v is CreditRole => (CREDIT_ROLES as readonly unknown[]).includes(v);

/** One person or company on a title. Mirrors an item of `titles.credits`. */
export type Credit = {
  role: CreditRole;
  /** The catalog's id (TMDB person or company, AniList staff, RAWG developer); a book author's lower-cased name. */
  id: string;
  name: string;
  /** A TMDB profile or logo path, or an AniList staff image URL; null when there is none. */
  image: string | null;
};

/** How many of each role a title keeps: the top-billed cast, and enough of the rest to find a favourite. */
export const CREDIT_LIMITS: Record<CreditRole, number> = { actor: 5, director: 3, studio: 3, author: 3, developer: 3 };

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max = 200): string | undefined => {
  const s = typeof v === "string" ? v.trim() : "";
  return s !== "" && s.length <= max ? s : undefined;
};
const numericId = (v: unknown): string | undefined => (typeof v === "number" && Number.isInteger(v) && v > 0 ? String(v) : undefined);
const tmdbPath = (v: unknown): string | null => {
  const p = text(v);
  return p && /^\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|svg|webp)$/.test(p) ? p : null;
};
const ANILIST_STAFF_RE = /^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/staff\/(medium|large)\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|gif|webp)$/;

/** Items of `list` as credits of `role` (`pick` returns null to skip one), one per id, at most the role's limit. */
function take(role: CreditRole, list: unknown, pick: (item: Json) => Omit<Credit, "role"> | null): Credit[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const credits: Credit[] = [];
  for (const item of list) {
    if (credits.length >= CREDIT_LIMITS[role]) break;
    const credit = isObject(item) ? pick(item) : null;
    if (!credit || seen.has(credit.id)) continue;
    seen.add(credit.id);
    credits.push({ role, ...credit });
  }
  return credits;
}

const tmdbPerson = (image: "profile_path" | "logo_path") => (item: Json) => {
  const id = numericId(item.id);
  const name = text(item.name);
  return id && name ? { id, name, image: tmdbPath(item[image]) } : null;
};

/**
 * A `/movie/{id}` or `/tv/{id}` body fetched with `append_to_response=credits`: the top-billed cast (by `order`), the
 * directors (a series' creators, `created_by`) and the production companies. Null when the body has no `credits`
 * (fetched without them: not known yet).
 */
export function tmdbCredits(kind: "movie" | "series", body: unknown): Credit[] | null {
  if (!isObject(body) || !isObject(body.credits)) return null;
  const cast = Array.isArray(body.credits.cast)
    ? [...body.credits.cast].filter(isObject).sort((a, b) => (typeof a.order === "number" ? a.order : 999) - (typeof b.order === "number" ? b.order : 999))
    : [];
  const directors =
    kind === "series"
      ? body.created_by
      : Array.isArray(body.credits.crew)
        ? body.credits.crew.filter((c) => isObject(c) && c.job === "Director")
        : [];
  return [
    ...take("actor", cast, tmdbPerson("profile_path")),
    ...take("director", directors, tmdbPerson("profile_path")),
    ...take("studio", body.production_companies, tmdbPerson("logo_path")),
  ];
}

/** A Google Books volume: its authors (no ids there, so a lower-cased name stands in). */
export function googleBooksCredits(body: unknown): Credit[] | null {
  if (!isObject(body) || !isObject(body.volumeInfo)) return null;
  const authors = Array.isArray(body.volumeInfo.authors) ? body.volumeInfo.authors.map((name) => ({ name })) : [];
  return take("author", authors, (item) => {
    const name = text(item.name);
    return name ? { id: name.toLocaleLowerCase("en"), name, image: null } : null;
  });
}

/** AniList's staff roles that wrote or drew the manga ("Story & Art", "Story", "Art", "Original Story", …). */
const MANGA_AUTHOR_ROLE = /^(Story|Art|Original (Story|Creator))\b/;

/** `ANILIST_DETAILS_QUERY`'s body: the staff who wrote or drew it. Null when it has no `staff` (an older fetch). */
export function anilistCredits(body: unknown): Credit[] | null {
  const media = isObject(body) && isObject(body.data) && isObject(body.data.Media) ? body.data.Media : null;
  if (!media || !isObject(media.staff) || !Array.isArray(media.staff.edges)) return null;
  const authors = media.staff.edges.filter((e) => isObject(e) && typeof e.role === "string" && MANGA_AUTHOR_ROLE.test(e.role));
  return take("author", authors, (edge) => {
    const node = isObject(edge.node) ? edge.node : {};
    const id = numericId(node.id);
    const name = isObject(node.name) ? text(node.name.full) : undefined;
    const image = isObject(node.image) ? text(node.image.medium) : undefined;
    return id && name ? { id, name, image: image && ANILIST_STAFF_RE.test(image) ? image : null } : null;
  });
}

/** A RAWG `/games/{id}` body: its developers (RAWG has no logos for them). */
export function rawgCredits(body: unknown): Credit[] | null {
  if (!isObject(body)) return null;
  return take("developer", body.developers, (item) => {
    const id = numericId(item.id);
    const name = text(item.name);
    return id && name ? { id, name, image: null } : null;
  });
}

/** The credits in a details body from `source`, or null when that body doesn't carry them. */
export function catalogCredits(source: CatalogSource, kind: TitleKind, body: unknown): Credit[] | null {
  if (source === "tmdb") return kind === "movie" || kind === "series" ? tmdbCredits(kind, body) : null;
  if (source === "google_books") return googleBooksCredits(body);
  if (source === "anilist") return anilistCredits(body);
  return rawgCredits(body);
}

/** Stored credits (`titles.credits`), checked again: anything malformed is dropped. Null stays null (not fetched yet). */
export function parseCredits(v: unknown): Credit[] | null {
  if (!Array.isArray(v)) return null;
  return v.flatMap((c): Credit[] => {
    if (!isObject(c) || !isCreditRole(c.role)) return [];
    const id = text(c.id);
    const name = text(c.name);
    const image = typeof c.image === "string" ? c.image : null;
    return id && name ? [{ role: c.role, id, name, image }] : [];
  });
}

/** A photo or logo URL for a credit from `source`: TMDB at w185, an AniList staff image as stored. Null otherwise. */
export function creditImageUrl(source: CatalogSource | string, image: string | null): string | null {
  if (!image) return null;
  if (source === "tmdb") return tmdbPath(image) ? tmdbImageUrl(image, "w185") : null;
  if (source === "anilist") return ANILIST_STAFF_RE.test(image) ? image : null;
  return null;
}
