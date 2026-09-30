// The CSV export (S3 import & export, ADR 0041): the user's live collection, episodes and reading logs with their
// titles, read as the user (RLS: their own rows), for `mystonieCsvFiles`. Deleted rows are only in the JSON export.
import { collectPages } from "@/core/account";
import type { CatalogSource, TitleKind } from "@/core/catalog/types";
import type { EntryStatus } from "@/core/collection/entries";
import type { ReadingUnit } from "@/core/collection/reading";
import type { ExportEntry, ExportEpisode, ExportReading } from "@/core/import/mystonie";
import type { UserClient } from "./supabase-server";

async function pages<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  return collectPages(async (from, to) => {
    const { data, error } = await read(from, to);
    if (error) throw new Error(`export read failed: ${error.message}`);
    return data ?? [];
  });
}

export async function exportCollection(
  db: UserClient,
  userId: string,
): Promise<{ entries: ExportEntry[]; episodes: ExportEpisode[]; reading: ExportReading[] }> {
  const [entries, episodes, reading] = await Promise.all([
    pages((from, to) =>
      db
        .from("entries")
        .select(
          "status, finished_at, rating, review, hours_played, created_at, title:titles!inner(source, kind, external_id, name, original_name, year, original_language, genres)",
        )
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("id")
        .range(from, to),
    ),
    pages((from, to) =>
      db
        .from("episode_logs")
        .select("season, episode, runtime_min, watched_at, title:titles!inner(source, external_id, name)")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("id")
        .range(from, to),
    ),
    pages((from, to) =>
      db
        .from("reading_logs")
        .select("unit, position, read_at, title:titles!inner(source, kind, external_id, name)")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("id")
        .range(from, to),
    ),
  ]);
  return {
    entries: entries.map((e) => ({
      kind: e.title.kind as TitleKind,
      source: e.title.source as CatalogSource,
      externalId: e.title.external_id,
      name: e.title.name,
      originalName: e.title.original_name,
      year: e.title.year,
      originalLanguage: e.title.original_language,
      genres: e.title.genres,
      status: e.status as EntryStatus,
      finishedAt: e.finished_at,
      rating: e.rating,
      review: e.review,
      addedAt: e.created_at,
      hoursPlayed: e.hours_played,
    })),
    episodes: episodes.map((e) => ({
      source: e.title.source as CatalogSource,
      externalId: e.title.external_id,
      name: e.title.name,
      season: e.season,
      episode: e.episode,
      runtimeMin: e.runtime_min,
      watchedAt: e.watched_at,
    })),
    reading: reading.map((r) => ({
      kind: r.title.kind as TitleKind,
      source: r.title.source as CatalogSource,
      externalId: r.title.external_id,
      name: r.title.name,
      unit: r.unit as ReadingUnit,
      position: r.position,
      readAt: r.read_at,
    })),
  };
}
