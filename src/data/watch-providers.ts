import type { TmdbKind } from "@/core/catalog/tmdb";
import { parseCountryOffers, type CountryOffers } from "@/core/catalog/watch-providers";
import type { CountryCode } from "@/core/countries";
import type { Json } from "./database.types";
import { adminClient } from "./supabase-admin";
import { watchProviders } from "./tmdb";

/** Cached provider data is refreshed after this long (S2 where to watch). */
export const PROVIDERS_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Where a movie or series streams in one country: `{ offers }` (null offers = nothing there), or null when TMDB
 * failed and nothing is cached. Every country is cached in one `title_providers` row; a stale row is refreshed
 * from TMDB and still used when TMDB is down (ADR 0032).
 */
export async function countryOffers(
  titleId: string,
  kind: TmdbKind,
  externalId: string,
  country: CountryCode,
): Promise<{ offers: CountryOffers | null } | null> {
  const db = adminClient();
  let cached: { offers: CountryOffers | null } | null = null;
  if (db) {
    // Only this country's slice of the row (`providers -> 'TH'`); the code is one of COUNTRY_CODES.
    const { data, error } = await db
      .from("title_providers")
      .select(`fetched_at, offers:providers->${country}` as "fetched_at, offers:providers->US")
      .eq("title_id", titleId)
      .maybeSingle();
    if (error) console.error("title_providers read failed", error.message);
    if (data) {
      cached = { offers: parseCountryOffers(data.offers) };
      if (Date.now() - Date.parse(data.fetched_at) <= PROVIDERS_TTL_MS) return cached;
    }
  }
  try {
    const all = await watchProviders(kind, externalId);
    if (db) {
      const { error } = await db
        .from("title_providers")
        .upsert({ title_id: titleId, providers: all as Json, fetched_at: new Date().toISOString() });
      if (error) console.error("title_providers upsert failed", error.message);
    }
    return { offers: all[country] ?? null };
  } catch (e) {
    console.warn("watch providers failed", e instanceof Error ? e.message : e);
    return cached;
  }
}
