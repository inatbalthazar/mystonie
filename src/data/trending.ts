// Trending on Mystonie (S3 finishers & the board, ADR 0039): the titles most people finished, watched or read this
// week, from our own logs. Counts only, from 3 people up (`trending_titles()`). The list is the same for everyone,
// so each server instance keeps it for a few minutes instead of asking Postgres on every Home render.
import { posterUrl } from "@/core/catalog/images";
import type { CatalogSource, TitleKind } from "@/core/catalog/types";
import type { TrendingTitle } from "@/core/trending";
import type { UserClient } from "./supabase-server";

const TTL_MS = 10 * 60 * 1000;
const DAYS = 7;
const LIMIT = 12;

let cached: { at: number; titles: TrendingTitle[] } | null = null;

/** This week's own trending titles, most people first. Empty (never throws) when the database can't be read. */
export async function ownTrending(db: UserClient, now = Date.now()): Promise<TrendingTitle[]> {
  // Development and tests always read fresh numbers.
  if (cached && now - cached.at < TTL_MS && process.env.NODE_ENV === "production") return cached.titles;
  const { data, error } = await db.rpc("trending_titles", { p_days: DAYS, p_limit: LIMIT });
  if (error) {
    console.warn(`trending_titles failed: ${error.message}`);
    return cached?.titles ?? [];
  }
  const titles = data.map((r): TrendingTitle => {
    const imageUrl = posterUrl(r.source as CatalogSource, r.poster_path);
    return {
      source: r.source as CatalogSource,
      kind: r.kind as TitleKind,
      externalId: r.external_id,
      name: r.name,
      ...(r.year ? { year: r.year } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      people: r.people,
    };
  });
  cached = { at: now, titles };
  return titles;
}
