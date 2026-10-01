// The Atlas's regions (stage 4, ADR 0060): the states, provinces or regions of a country someone has been to. Ids come
// from the generated `regions.ts` (ISO 3166-2 where there is one); a region's country is its first two letters. Server
// side mostly: the id list is about 30 KB, so pages hand the browser only the country it shows.
import { isCountryCode, type CountryCode } from "./countries";
import { COUNTRY_REGIONS, type RegionKind } from "./regions";

export type CountryRegions = { kind: RegionKind; ids: readonly string[] };

const REGION_ID = /^[A-Z]{2}-[A-Z0-9]{1,8}$/;

const split = new Map<CountryCode, readonly string[]>();

/** A country's regions and what they are called (states, provinces, …), or null for a country without any. */
export function regionsOf(country: CountryCode): CountryRegions | null {
  const entry = COUNTRY_REGIONS[country];
  if (!entry) return null;
  let ids = split.get(country);
  if (!ids) {
    ids = entry.ids.split(" ");
    split.set(country, ids);
  }
  return { kind: entry.kind, ids };
}

/** The country a region id belongs to (its first two letters). */
export const regionCountry = (region: string): CountryCode => region.slice(0, 2) as CountryCode;

/** Whether `v` is the id of a region on the map (not just shaped like one). */
export function isRegionId(v: unknown): v is string {
  if (typeof v !== "string" || !REGION_ID.test(v)) return false;
  const country = regionCountry(v);
  return isCountryCode(country) && (regionsOf(country)?.ids.includes(v) ?? false);
}

/** What `POST /api/places/regions` writes: a region marked (been there) or unmarked. */
export type RegionWrite = { region: string; country: CountryCode; visited: boolean };

/** Validates a `POST /api/places/regions` body: `{ region, visited: boolean }`. */
export function parseRegionWrite(body: unknown): RegionWrite | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { region, visited } = body as Record<string, unknown>;
  if (!isRegionId(region) || typeof visited !== "boolean") return null;
  return { region, country: regionCountry(region), visited };
}

/** Marked regions per country, only the ids that are on the map (in the map's order). */
export function regionsByCountry(regions: Iterable<string>): Map<CountryCode, string[]> {
  const marked = new Set(regions);
  const out = new Map<CountryCode, string[]>();
  for (const id of marked) {
    if (!isRegionId(id)) continue;
    const country = regionCountry(id);
    out.set(country, [...(out.get(country) ?? []), id]);
  }
  for (const [country, list] of out) {
    const order = regionsOf(country)!.ids;
    list.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }
  return out;
}
