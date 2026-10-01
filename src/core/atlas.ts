// The Atlas (stage 4, ADR 0059): the countries you've been to (and lived in, and want to go to), and the countries the
// stories you watch and read come from, on one world map. Countries are ISO 3166-1 alpha-2 codes, named by `Intl`
// in the viewer's language, so nothing here signals a home country. Country level only: regions would need every
// country's subdivisions, not one country's provinces (ADR 0007).
import { CONTINENT_OF, CONTINENTS, type Continent } from "./continents";
import { isCountryCode, type CountryCode } from "./countries";

/** been: visited. lived: lived there (counts as visited). want: want to go (not visited). */
export const PLACE_STATUSES = ["been", "lived", "want"] as const;
export type PlaceStatus = (typeof PLACE_STATUSES)[number];

export const isPlaceStatus = (v: unknown): v is PlaceStatus => (PLACE_STATUSES as readonly unknown[]).includes(v);

/** The earliest first-visit year accepted (`places.first_year`). */
export const FIRST_YEAR_MIN = 1900;

export type Place = { country: CountryCode; status: PlaceStatus; firstYear: number | null };

/** Whether the place counts as visited (been or lived there). */
export const isVisited = (place: Pick<Place, "status">) => place.status !== "want";

/** The continents of the map, in the order the Atlas lists them (Antarctica last: it isn't drawn). */
export const ATLAS_CONTINENTS: readonly Continent[] = ["africa", "asia", "europe", "north_america", "south_america", "oceania", "antarctica"];

export const continentOf = (code: CountryCode): Continent => CONTINENT_OF[code];

/** What `POST /api/places` writes: a status for the country, or null to take it off the map. */
export type PlaceWrite = { country: CountryCode; status: PlaceStatus | null; firstYear: number | null };

/**
 * Validates a `POST /api/places` body: `{ country, status: "been" | "lived" | "want" | null, firstYear?: number | null }`.
 * A first-visit year goes with a visit only (not "want"), from 1900 to `thisYear`.
 */
export function parsePlaceWrite(body: unknown, thisYear: number): PlaceWrite | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { country, status, firstYear } = body as Record<string, unknown>;
  if (!isCountryCode(country)) return null;
  if (status !== null && !isPlaceStatus(status)) return null;
  if (firstYear !== undefined && firstYear !== null) {
    if (typeof firstYear !== "number" || !Number.isInteger(firstYear) || firstYear < FIRST_YEAR_MIN || firstYear > thisYear) return null;
    if (status === null || status === "want") return null;
  }
  return { country, status, firstYear: (firstYear as number | null | undefined) ?? null };
}

const codesOf = (list: unknown, key?: string): CountryCode[] => {
  if (!Array.isArray(list)) return [];
  return list.map((item) => (key && typeof item === "object" && item !== null ? (item as Record<string, unknown>)[key] : item)).filter(isCountryCode);
};

/**
 * The countries a title comes from, read from its cached catalog body (`titles.raw`): TMDB's `origin_country` (movies
 * and series), else its production countries; AniList's `countryOfOrigin` (manga). Books and games have none
 * (Google Books and RAWG don't say).
 */
export function titleCountries(source: string, raw: unknown): CountryCode[] {
  if (typeof raw !== "object" || raw === null) return [];
  const r = raw as Record<string, unknown>;
  if (source === "tmdb") {
    const origin = codesOf(r.origin_country);
    return [...new Set(origin.length > 0 ? origin : codesOf(r.production_countries, "iso_3166_1"))];
  }
  if (source === "anilist") return isCountryCode(r.countryOfOrigin) ? [r.countryOfOrigin] : [];
  return [];
}

/** A title in the Stories layer: watched or read (started or finished), with the countries it comes from. */
export type StoryTitle = { id: string; kind: string; name: string; posterUrl: string | null; href: string; countries: CountryCode[] };

/** Each country's stories, most first, then by name; a co-production counts for each of its countries. */
export function storiesByCountry(titles: readonly StoryTitle[]): Map<CountryCode, StoryTitle[]> {
  const out = new Map<CountryCode, StoryTitle[]>();
  for (const title of titles) {
    for (const code of title.countries) out.set(code, [...(out.get(code) ?? []), title]);
  }
  return new Map([...out].sort(([a, x], [b, y]) => y.length - x.length || a.localeCompare(b)));
}

/** How strongly a country is coloured in the Stories layer (1 to 4) by its number of stories. */
export function storyLevel(count: number): 1 | 2 | 3 | 4 {
  if (count >= 10) return 4;
  if (count >= 4) return 3;
  if (count >= 2) return 2;
  return 1;
}

export type AtlasSummary = {
  /** Countries visited (been or lived), and lived in. */
  been: number;
  lived: number;
  want: number;
  /** Continents with a visited country (of the 7). */
  continents: number;
  /** Visited countries per continent (every continent present, 0 when none). */
  byContinent: Record<Continent, number>;
  /** Countries the stories come from. */
  stories: number;
  /** Countries both visited and in the stories ("been there, watched that"). */
  both: number;
};

export function atlasSummary(places: readonly Place[], storyCountries: Iterable<CountryCode>): AtlasSummary {
  const visited = places.filter(isVisited);
  const byContinent = Object.fromEntries(CONTINENTS.map((c) => [c, 0])) as Record<Continent, number>;
  for (const p of visited) byContinent[continentOf(p.country)] += 1;
  const stories = new Set(storyCountries);
  return {
    been: visited.length,
    lived: visited.filter((p) => p.status === "lived").length,
    want: places.length - visited.length,
    continents: CONTINENTS.filter((c) => byContinent[c] > 0).length,
    byContinent,
    stories: stories.size,
    both: visited.filter((p) => stories.has(p.country)).length,
  };
}

/** Places grouped by continent in `ATLAS_CONTINENTS` order, each group sorted by `name` (the viewer's language). */
export function placesByContinent<T extends { country: CountryCode }>(
  places: readonly T[],
  name: (code: CountryCode) => string,
  locale: string,
): [Continent, T[]][] {
  const collator = new Intl.Collator(locale);
  return ATLAS_CONTINENTS.map((c): [Continent, T[]] => [
    c,
    places.filter((p) => continentOf(p.country) === c).sort((a, b) => collator.compare(name(a.country), name(b.country))),
  ]).filter(([, list]) => list.length > 0);
}

/** Short names people type that aren't the ISO code. */
const ALIASES: Record<string, CountryCode> = { uk: "GB", usa: "US", uae: "AE", drc: "CD" };

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/**
 * The Atlas's country search: `options` are `[code, name in the viewer's language, English name]`. Names that start
 * with the query come first, then a word in them that does, then any match; accents and case don't matter, and the
 * code or a common short name (UK, USA) finds its country too.
 */
export function searchCountries(query: string, options: readonly (readonly [CountryCode, string, string])[], limit = 8): CountryCode[] {
  const q = fold(query);
  if (!q) return [];
  const rank = ([code, local, english]: readonly [CountryCode, string, string]): number =>
    q.length <= 3 && (code.toLowerCase() === q || ALIASES[q] === code) ? 0 : nameRank(q, local, english);
  return ranked(options, rank, limit);
}

/** 1: a name starts with the (folded) query, 2: a word in it does, 3: it's somewhere in it, 9: no match. */
function nameRank(q: string, ...names: string[]): number {
  const folded = names.map(fold);
  if (folded.some((n) => n.startsWith(q))) return 1;
  if (folded.some((n) => n.split(/[\s\-–'’(),.]+/).some((w) => w.startsWith(q)))) return 2;
  if (folded.some((n) => n.includes(q))) return 3;
  return 9;
}

function ranked<T extends string>(
  options: readonly (readonly [T, string, string])[],
  rank: (o: readonly [T, string, string]) => number,
  limit: number,
): T[] {
  return options
    .map((o, i) => ({ id: o[0], r: rank(o), i }))
    .filter((o) => o.r < 9)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, limit)
    .map((o) => o.id);
}

/**
 * The region search on a country's page (ADR 0060): `options` are `[id, name in the viewer's language, English name]`,
 * ranked like countries (accents and case don't matter). Every match, for the list to filter.
 */
export function searchRegions(query: string, options: readonly (readonly [string, string, string])[]): string[] {
  const q = fold(query);
  if (!q) return options.map((o) => o[0]);
  return ranked(options, ([, local, english]) => nameRank(q, local, english), options.length);
}

/** The countries of an Atlas card: visited ones, unique and sorted (what the card colours in). */
export function atlasCardCountries(places: readonly Place[]): CountryCode[] {
  return [...new Set(places.filter(isVisited).map((p) => p.country))].sort();
}

/** Continents with at least one of `countries`. */
export function continentCount(countries: readonly CountryCode[]): number {
  return new Set(countries.map(continentOf)).size;
}
