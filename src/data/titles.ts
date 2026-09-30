import { sourceForKind, type Title, type TitleKind } from "@/core/catalog/types";
import { catalogDetails } from "./catalog";
import type { Database, Json } from "./database.types";
import { adminClient } from "./supabase-admin";

type Row = Database["public"]["Tables"]["titles"]["Row"];

/** Cached details are refreshed after this long. */
export const TITLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function titleFromRow(row: Row): Title {
  return {
    source: row.source as Title["source"],
    externalId: row.external_id,
    kind: row.kind as Title["kind"],
    name: row.name,
    originalName: row.original_name,
    originalLanguage: row.original_language,
    year: row.year,
    posterPath: row.poster_path,
    genres: row.genres,
    runtimeMin: row.runtime_min,
    episodeCount: row.episode_count,
    seasonCount: row.season_count,
    pageCount: row.page_count,
    chapterCount: row.chapter_count,
    volumeCount: row.volume_count,
    playtimeHours: row.playtime_hours,
    platforms: row.platforms,
  };
}

/** The cached title (with whether it's past its TTL), or null. */
export async function getCachedTitle(
  source: Title["source"],
  kind: TitleKind,
  externalId: string,
): Promise<{ id: string; title: Title; stale: boolean } | null> {
  const db = adminClient();
  if (!db) return null;
  const { data, error } = await db
    .from("titles")
    .select("*")
    .eq("source", source)
    .eq("kind", kind)
    .eq("external_id", externalId)
    .maybeSingle();
  if (error) console.error("titles read failed", error.message);
  if (!data) return null;
  return { id: data.id, title: titleFromRow(data), stale: Date.now() - Date.parse(data.fetched_at) > TITLE_TTL_MS };
}

/** Caches a title; returns its row id (null when the database is unavailable). */
export async function saveTitle(title: Title, raw: unknown): Promise<string | null> {
  const db = adminClient();
  if (!db) return null;
  const { data, error } = await db.from("titles").upsert(
    {
      source: title.source,
      kind: title.kind,
      external_id: title.externalId,
      name: title.name,
      original_name: title.originalName,
      original_language: title.originalLanguage,
      year: title.year,
      poster_path: title.posterPath,
      genres: title.genres,
      runtime_min: title.runtimeMin,
      episode_count: title.episodeCount,
      season_count: title.seasonCount,
      page_count: title.pageCount,
      chapter_count: title.chapterCount,
      volume_count: title.volumeCount,
      playtime_hours: title.playtimeHours,
      platforms: title.platforms,
      raw: raw as Json,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "source,kind,external_id" },
  ).select("id").single();
  if (error) console.error("titles upsert failed", error.message);
  return data?.id ?? null;
}

/**
 * The `titles` row id for a title (from its kind's catalog: TMDB, AniList, Google Books or RAWG), fetching and caching it
 * first when needed (adding to the collection). A cached copy is good enough even when stale. Null when the catalog
 * doesn't know the title; throws `CatalogError` when the catalog fails.
 */
export async function ensureTitle(kind: TitleKind, externalId: string): Promise<{ id: string; title: Title } | null> {
  const cached = await getCachedTitle(sourceForKind(kind), kind, externalId);
  if (cached) return { id: cached.id, title: cached.title };
  const details = await catalogDetails(kind, externalId);
  if (!details) return null;
  const id = await saveTitle(details.title, details.raw);
  return id ? { id, title: details.title } : null;
}
