// Normalizes RAWG v1 JSON (`/games?search=` and `/games/{id}`, ADR 0044). Input is untrusted: every field is checked,
// and unusable items are dropped. Adult games (RAWG's "nsfw" and "hentai" tags) are left out, as adult titles are on
// AniList and Google Books. RAWG's ESRB field isn't used for that: it calls Hitman (2016) "Adults Only". Art is RAWG's
// landscape key art, kept as its media path.
import { isRawgMediaPath, rawgImageUrl, rawgMediaPath } from "./images";
import { hasEveryWord, searchWords } from "./search";
import type { SearchResult, Title } from "./types";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);

/** How many games a search asks RAWG for (its largest page), so the ranking has famous games to pick from. */
export const RAWG_PAGE_SIZE = 40;
/** How many of them a search lists. */
export const RAWG_RESULTS = 20;
/**
 * How many of those "All" merges with the other catalogs: the best known only. The merge puts exact names first, and
 * RAWG has a fan project or a jam game named after nearly everything ("witcher": 2 people added it).
 */
export const RAWG_ALL_RESULTS = 8;

/** `/games` query parameters for a search: exact-ish matches, no DLC (the base game is what people finish). */
export function rawgSearchParams(query: string): Record<string, string> {
  return { search: query, search_precise: "true", exclude_additions: "true", page_size: String(RAWG_PAGE_SIZE) };
}

const ADULT_TAGS = new Set(["nsfw", "hentai"]);

/** RAWG's parent platforms by slug, as the app names them (brand names, the same in every language). */
const PLATFORM_NAMES: Record<string, string> = {
  pc: "PC",
  playstation: "PlayStation",
  xbox: "Xbox",
  nintendo: "Nintendo",
  mac: "Mac",
  linux: "Linux",
  ios: "iOS",
  android: "Android",
  web: "Web",
};

/** `parent_platforms` → platform names: `[{ platform: { slug, name } }]` as the API sends it (plain slugs are read too). */
function platforms(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const names = v.flatMap((item) => {
    const platform = isObject(item) && isObject(item.platform) ? item.platform : null;
    const slug = platform ? text(platform.slug) : text(item);
    const name = (slug && PLATFORM_NAMES[slug]) ?? (platform ? text(platform.name) : undefined);
    return name && name.length <= 40 ? [name] : [];
  });
  return [...new Set(names)].slice(0, 8);
}

type Game = {
  externalId: string;
  name: string;
  originalName?: string;
  year?: number;
  imagePath?: string;
  genres: string[];
  playtimeHours?: number;
  platforms: string[];
  /** How many RAWG users added it to their library: how well known it is. */
  added: number;
};

function game(raw: unknown): Game | null {
  if (!isObject(raw)) return null;
  const externalId = typeof raw.id === "number" && Number.isInteger(raw.id) && raw.id > 0 && raw.id < 1e10 ? String(raw.id) : undefined;
  const name = text(raw.name);
  if (!externalId || !name) return null;
  if (Array.isArray(raw.tags) && raw.tags.some((t) => isObject(t) && ADULT_TAGS.has(t.slug as string))) return null;
  const released = raw.tba === true ? undefined : text(raw.released);
  const year = Number(released?.match(/^(\d{4})-\d{2}-\d{2}$/)?.[1]);
  const image = text(raw.background_image);
  const imagePath = image ? (rawgMediaPath(image) ?? undefined) : undefined;
  const original = text(raw.name_original);
  const playtime = raw.playtime;
  return {
    externalId,
    name,
    originalName: original && original !== name ? original : undefined,
    year: year >= 1950 && year <= 2200 ? year : undefined,
    imagePath: imagePath && isRawgMediaPath(imagePath) ? imagePath : undefined,
    genres: Array.isArray(raw.genres) ? [...new Set(raw.genres.flatMap((g) => (isObject(g) && text(g.name) ? [text(g.name)!] : [])))].slice(0, 5) : [],
    playtimeHours: typeof playtime === "number" && Number.isInteger(playtime) && playtime > 0 && playtime <= 10_000 ? playtime : undefined,
    platforms: platforms(raw.parent_platforms),
    added: typeof raw.added === "number" && Number.isFinite(raw.added) && raw.added > 0 ? raw.added : 0,
  };
}

/**
 * RAWG's relevance order buries famous games under fan projects and jam games: for "zelda" it put Breath of the Wild
 * 30th (checked 2026-09-30). So names with every word of the query come first, then the games more people added on
 * RAWG, then RAWG's order.
 */
function rankGames(games: readonly Game[], query: string): Game[] {
  const q = searchWords(query);
  return games
    .map((g, i) => ({ g, i, full: [g.name, g.originalName].some((n) => !!n && hasEveryWord(n, q)) }))
    .sort((a, b) => Number(b.full) - Number(a.full) || b.g.added - a.g.added || a.i - b.i)
    .map(({ g }) => g);
}

/** `/games?search=` → the `RAWG_RESULTS` best results for `query`, best known first (`rankGames`). */
export function normalizeRawgSearch(body: unknown, query: string): SearchResult[] {
  if (!isObject(body) || !Array.isArray(body.results)) return [];
  const seen = new Set<string>();
  const games = body.results.flatMap((raw) => {
    const g = game(raw);
    if (!g || seen.has(g.externalId)) return [];
    seen.add(g.externalId);
    return [g];
  });
  return rankGames(games, query).slice(0, RAWG_RESULTS).map((g) => {
    const result: SearchResult = { source: "rawg", externalId: g.externalId, kind: "game", name: g.name };
    if (g.originalName) result.originalName = g.originalName;
    if (g.year) result.year = g.year;
    if (g.imagePath) result.imageUrl = rawgImageUrl(g.imagePath, 420);
    if (g.platforms.length) result.platforms = g.platforms;
    return result;
  });
}

/** `/games/{id}` → the `titles` row we cache. RAWG's average playtime is often 0 for console games (then null). */
export function normalizeRawgDetails(body: unknown): Title | null {
  const g = game(body);
  if (!g) return null;
  return {
    source: "rawg",
    externalId: g.externalId,
    kind: "game",
    name: g.name,
    originalName: g.originalName ?? null,
    originalLanguage: null,
    year: g.year ?? null,
    posterPath: g.imagePath ?? null,
    genres: g.genres,
    runtimeMin: null,
    episodeCount: null,
    seasonCount: null,
    pageCount: null,
    chapterCount: null,
    volumeCount: null,
    playtimeHours: g.playtimeHours ?? null,
    platforms: g.platforms,
  };
}
