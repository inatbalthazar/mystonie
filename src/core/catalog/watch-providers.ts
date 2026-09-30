// Where to watch (S2): TMDB's `/{movie|tv}/{id}/watch/providers` (data by JustWatch), normalized per country.
// Input is untrusted: every field is checked, and unusable providers are dropped.
import { isCountryCode } from "../countries";
import { tmdbMediaType, type TmdbKind } from "./tmdb";

/** How a service offers the title: in a subscription, free (with or without ads), or to rent or buy. */
export const OFFER_GROUPS = ["stream", "free", "buy"] as const;
export type OfferGroup = (typeof OFFER_GROUPS)[number];

/** One service. `logo` is a TMDB image path (`/abc.png`). */
export type Provider = { id: number; name: string; logo: string };

/** One country's services by group (each ordered by TMDB's display priority); a group without any is left out. */
export type CountryOffers = Partial<Record<OfferGroup, Provider[]>>;

/** Every country TMDB knows services for, by ISO 3166-1 code. A country missing here has none. */
export type WatchProviders = Record<string, CountryOffers>;

/** TMDB's offer types → our groups. Renting and buying share a group: the same stores do both. */
const GROUP_OF: Record<string, OfferGroup> = { flatrate: "stream", free: "free", ads: "free", rent: "buy", buy: "buy" };

/** At most this many services per group (the long tail is on TMDB's watch page). */
export const GROUP_MAX = 8;

const NAME_MAX = 80;
const LOGO_RE = /^\/[A-Za-z0-9_-]{1,64}\.(?:png|jpe?g|svg|webp)$/;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

function provider(raw: unknown): (Provider & { priority: number }) | null {
  if (!isObject(raw)) return null;
  const id = raw.provider_id;
  const name = typeof raw.provider_name === "string" ? raw.provider_name.trim() : "";
  const logo = raw.logo_path;
  if (!Number.isInteger(id) || (id as number) <= 0 || !name || name.length > NAME_MAX || typeof logo !== "string" || !LOGO_RE.test(logo)) return null;
  const priority = typeof raw.display_priority === "number" && Number.isFinite(raw.display_priority) ? raw.display_priority : 1e6;
  return { id: id as number, name, logo, priority };
}

function countryOffers(raw: unknown): CountryOffers | null {
  if (!isObject(raw)) return null;
  const offers: CountryOffers = {};
  for (const group of OFFER_GROUPS) {
    const seen = new Map<number, Provider & { priority: number }>();
    for (const [type, list] of Object.entries(raw)) {
      if (GROUP_OF[type] !== group || !Array.isArray(list)) continue;
      for (const item of list) {
        const p = provider(item);
        if (p && (seen.get(p.id)?.priority ?? Infinity) > p.priority) seen.set(p.id, p);
      }
    }
    const sorted = [...seen.values()].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)).slice(0, GROUP_MAX);
    if (sorted.length > 0) offers[group] = sorted.map(({ id, name, logo }) => ({ id, name, logo }));
  }
  return Object.keys(offers).length > 0 ? offers : null;
}

/** TMDB's watch-providers body → every country with at least one service. */
export function normalizeTmdbWatchProviders(body: unknown): WatchProviders {
  const results = isObject(body) && isObject(body.results) ? body.results : {};
  const out: WatchProviders = {};
  for (const [country, raw] of Object.entries(results)) {
    if (!isCountryCode(country)) continue;
    const offers = countryOffers(raw);
    if (offers) out[country] = offers;
  }
  return out;
}

/** One country's offers read back from the cache (`title_providers.providers -> 'US'`); null when there are none. */
export function parseCountryOffers(raw: unknown): CountryOffers | null {
  if (!isObject(raw)) return null;
  const offers: CountryOffers = {};
  for (const group of OFFER_GROUPS) {
    const list = raw[group];
    if (!Array.isArray(list)) continue;
    const valid = list
      .map((p) => (isObject(p) ? provider({ provider_id: p.id, provider_name: p.name, logo_path: p.logo }) : null))
      .filter((p) => p !== null)
      .slice(0, GROUP_MAX)
      .map(({ id, name, logo }) => ({ id, name, logo }));
    if (valid.length > 0) offers[group] = valid;
  }
  return Object.keys(offers).length > 0 ? offers : null;
}

/**
 * TMDB's "where to watch" page for the title in one country. TMDB's API has no per-service links; this page lists
 * JustWatch's deep links into each service, so every logo points here.
 */
export function tmdbWatchUrl(kind: TmdbKind, externalId: string, country: string): string {
  return `https://www.themoviedb.org/${tmdbMediaType(kind)}/${encodeURIComponent(externalId)}/watch?locale=${encodeURIComponent(country)}`;
}

/** JustWatch, which TMDB's terms require us to credit wherever provider data appears. */
export const JUSTWATCH_URL = "https://www.justwatch.com";
