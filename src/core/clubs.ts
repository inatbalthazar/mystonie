// Fandom clubs (S3 challenges & clubs, ADR 0040): Strava's clubs, for fandoms. The catalogue is data in code, each
// club with the filter that says which titles belong to it; membership rows live in `club_members`. The club page
// shows what its members finish (`club_feed`) and what they're on lately (`club_trending`), both filtered by this.
import type { StatsEntry } from "./stats/summary";
import { fitsFilter, genreKeys, GENRES, type TasteTitle, type TitleFilter } from "./taste";

export type Club = { slug: string; filter: TitleFilter };

/** The catalogue, in the order the clubs page lists it. Names are English in every locale, like badges. */
export const CLUBS = [
  { slug: "kdrama", filter: { kinds: ["series"], languages: ["ko"] } },
  { slug: "anime", filter: { kinds: ["movie", "series"], genres: GENRES.animation, languages: ["ja"] } },
  { slug: "manga", filter: { kinds: ["manga"] } },
  { slug: "books", filter: { kinds: ["book"] } },
  { slug: "games", filter: { kinds: ["game"] } },
  { slug: "cdrama", filter: { kinds: ["series"], languages: ["zh", "cn"] } },
  { slug: "indian-cinema", filter: { kinds: ["movie"], languages: ["hi", "ta", "te", "ml", "kn", "bn", "mr"] } },
  { slug: "horror", filter: { genres: GENRES.horror } },
  { slug: "romance", filter: { genres: GENRES.romance } },
  { slug: "scifi", filter: { genres: [...GENRES.scifi, ...GENRES.fantasy] } },
  { slug: "mystery", filter: { genres: GENRES.mystery } },
  { slug: "comedy", filter: { genres: GENRES.comedy } },
  { slug: "docs", filter: { genres: GENRES.documentary } },
] as const satisfies readonly Club[];

export type ClubSlug = (typeof CLUBS)[number]["slug"];

const BY_SLUG: ReadonlyMap<string, Club> = new Map(CLUBS.map((c) => [c.slug, c]));
export const isClubSlug = (value: unknown): value is ClubSlug => typeof value === "string" && BY_SLUG.has(value);
export const findClub = (slug: unknown): Club | null => (typeof slug === "string" ? (BY_SLUG.get(slug) ?? null) : null);

/** The club filter as `club_feed` / `club_trending` take it (null = any). */
export function clubRpcFilter(club: Club): { p_kinds: string[] | undefined; p_genres: string[] | undefined; p_languages: string[] | undefined } {
  const list = (v: readonly string[] | undefined) => (v && v.length ? [...v] : undefined);
  return { p_kinds: list(club.filter.kinds), p_genres: list(club.filter.genres), p_languages: list(club.filter.languages) };
}

/** The clubs a title belongs to, in catalogue order (the title page's "Clubs for this"). */
export function clubsForTitle(title: TasteTitle): ClubSlug[] {
  const genres = genreKeys(title.genres);
  return CLUBS.filter((c) => fitsFilter(c.filter, title, genres)).map((c) => c.slug);
}

/**
 * How many of the user's finishes belong to each club: "12 of your finishes fit". Clubs the user fits best come
 * first on the clubs page.
 */
export function clubFit(titles: readonly (TasteTitle & { id: string })[], entries: readonly StatsEntry[]): Map<ClubSlug, number> {
  const titleById = new Map(titles.map((t) => [t.id, t]));
  const fit = new Map<ClubSlug, number>(CLUBS.map((c) => [c.slug, 0]));
  for (const e of entries) {
    if (e.deletedAt || e.status !== "finished") continue;
    const title = titleById.get(e.titleId);
    if (!title) continue;
    for (const slug of clubsForTitle(title)) fit.set(slug, fit.get(slug)! + 1);
  }
  return fit;
}

/** Clubs in display order: the ones the user is in, then by fit (most first), then catalogue order. */
export function orderClubs(members: ReadonlySet<string>, fit: ReadonlyMap<string, number>): ClubSlug[] {
  const order = new Map(CLUBS.map((c, i) => [c.slug, i]));
  return CLUBS.map((c) => c.slug).sort(
    (a, b) => Number(members.has(b)) - Number(members.has(a)) || (fit.get(b) ?? 0) - (fit.get(a) ?? 0) || order.get(a)! - order.get(b)!,
  );
}

/** POST /api/clubs `{ club, join }`. */
export function parseClubToggle(body: unknown): { club: ClubSlug; on: boolean } | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { club, join } = body as Record<string, unknown>;
  return isClubSlug(club) && typeof join === "boolean" ? { club, on: join } : null;
}
