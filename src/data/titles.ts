import type { Title, TitleKind } from "@/core/catalog/types";
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
  };
}

/** The cached title (with whether it's past its TTL), or null. */
export async function getCachedTitle(
  source: Title["source"],
  kind: TitleKind,
  externalId: string,
): Promise<{ title: Title; stale: boolean } | null> {
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
  return { title: titleFromRow(data), stale: Date.now() - Date.parse(data.fetched_at) > TITLE_TTL_MS };
}

export async function saveTitle(title: Title, raw: unknown): Promise<void> {
  const db = adminClient();
  if (!db) return;
  const { error } = await db.from("titles").upsert(
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
      raw: raw as Json,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "source,kind,external_id" },
  );
  if (error) console.error("titles upsert failed", error.message);
}
