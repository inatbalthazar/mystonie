import { catalogCredits } from "@/core/catalog/credits";
import { sourceForKind, type Title, type TitleKind } from "@/core/catalog/types";
import { catalogDetails } from "./catalog";
import { CatalogError } from "./catalog-error";
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

/**
 * A details body as `titles.raw` keeps it: TMDB's cast and crew lists (hundreds of people) are left out, since
 * `titles.credits` keeps the few that count.
 */
function storedRaw(title: Title, raw: unknown): Json {
  if (title.source !== "tmdb" || typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw as Json;
  const rest = { ...(raw as Record<string, unknown>) };
  delete rest.credits;
  return rest as Json;
}

/**
 * Caches a title; returns its row id (null when the database is unavailable). Its credits come from the same body
 * (`catalogCredits`); a body without them leaves the stored ones as they are.
 */
export async function saveTitle(title: Title, raw: unknown): Promise<string | null> {
  const db = adminClient();
  if (!db) return null;
  const credits = catalogCredits(title.source, title.kind, raw);
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
      raw: storedRaw(title, raw),
      ...(credits ? { credits: credits as Json } : {}),
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

/** A cached title's details body and credits (the ➕ sheet's details, ADR 0058); nulls when unknown. */
export async function titleExtras(titleId: string): Promise<{ raw: unknown; credits: unknown }> {
  const db = adminClient();
  if (!db) return { raw: null, credits: null };
  const { data, error } = await db.from("titles").select("raw, credits").eq("id", titleId).maybeSingle();
  if (error) console.error("titles read failed", error.message);
  return { raw: data?.raw ?? null, credits: data?.credits ?? null };
}

/** Titles fetched in parallel by one backfill batch: TMDB allows ~50 requests a second, AniList ~30 a minute. */
const BACKFILL_CONCURRENCY = 4;

export type BackfillResult = { fromCache: number; fetched: number; failed: number; remaining: number };

/**
 * One batch of the credits backfill (stage 4, ADR 0047): up to `limit` titles without `credits`, least recently
 * touched first. A cached body that already carries them (books, games) fills them without a call; the rest are
 * fetched again from their catalog (details and credits in one request). A title the catalog no longer knows gets no credits (`[]`), so
 * it isn't asked again; a failed fetch goes to the back of the queue for the next run.
 */
export async function backfillCredits(limit: number): Promise<BackfillResult | null> {
  const db = adminClient();
  if (!db) return null;
  const { data, error } = await db
    .from("titles")
    .select("id, source, kind, external_id, raw")
    .is("credits", null)
    .order("updated_at")
    .limit(limit);
  if (error) throw new Error(`titles read failed: ${error.message}`);

  const result: BackfillResult = { fromCache: 0, fetched: 0, failed: 0, remaining: 0 };
  const fill = async (row: (typeof data)[number]) => {
    const source = row.source as Title["source"];
    const cached = catalogCredits(source, row.kind as TitleKind, row.raw);
    if (cached) {
      const { error: updateError } = await db.from("titles").update({ credits: cached as Json }).eq("id", row.id);
      if (updateError) throw new Error(updateError.message);
      result.fromCache += 1;
      return;
    }
    // TMDB answers an unknown id with a 404 error, the other catalogs with null: both mean "no such title".
    const details = await catalogDetails(row.kind as TitleKind, row.external_id).catch((error: unknown) => {
      if (error instanceof CatalogError && error.status === 404) return null;
      throw error;
    });
    if (!details) {
      await db.from("titles").update({ credits: [] }).eq("id", row.id);
    } else if (!(await saveTitle(details.title, details.raw))) {
      throw new Error("titles upsert failed");
    }
    result.fetched += 1;
  };
  for (let i = 0; i < data.length; i += BACKFILL_CONCURRENCY) {
    const batch = data.slice(i, i + BACKFILL_CONCURRENCY);
    const settled = await Promise.allSettled(batch.map(fill));
    for (const [j, s] of settled.entries()) {
      if (s.status === "rejected") {
        result.failed += 1;
        console.warn("credits backfill failed", s.reason);
        // Touching the row (its trigger stamps `updated_at`) sends it to the back, so failures never block the rest.
        await db.from("titles").update({ credits: null }).eq("id", batch[j]!.id);
      }
    }
  }

  const { count } = await db.from("titles").select("id", { count: "exact", head: true }).is("credits", null);
  result.remaining = count ?? 0;
  return result;
}
