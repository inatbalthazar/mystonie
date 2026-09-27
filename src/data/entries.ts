import { tmdbImageUrl } from "@/core/catalog/tmdb";
import { sortCollection, type CollectionItem, type EntryPatch, type NewEntry } from "@/core/collection/entries";
import type { Database } from "./database.types";
import type { UserClient } from "./supabase-server";

type EntryRow = Pick<Database["public"]["Tables"]["entries"]["Row"], "id" | "status" | "finished_at" | "created_at" | "rating" | "review">;
type TitleRow = Pick<
  Database["public"]["Tables"]["titles"]["Row"],
  "id" | "source" | "kind" | "external_id" | "name" | "year" | "poster_path" | "genres" | "runtime_min" | "episode_count"
>;

// The entry plus the title fields a collection row shows (RLS: the signed-in user's rows).
const COLUMNS = "id, status, finished_at, created_at, rating, review, title:titles!inner(id, source, kind, external_id, name, year, poster_path, genres, runtime_min, episode_count)";

function itemFromRow(row: EntryRow & { title: TitleRow }): CollectionItem {
  return {
    id: row.id,
    status: row.status as CollectionItem["status"],
    finishedAt: row.finished_at,
    addedAt: row.created_at,
    rating: row.rating,
    review: row.review,
    title: {
      id: row.title.id,
      source: "tmdb",
      kind: row.title.kind as CollectionItem["title"]["kind"],
      externalId: row.title.external_id,
      name: row.title.name,
      year: row.title.year,
      posterUrl: row.title.poster_path ? tmdbImageUrl(row.title.poster_path, "w342") : null,
      genres: row.title.genres,
      runtimeMin: row.title.runtime_min,
      episodeCount: row.title.episode_count,
    },
  };
}

/** The signed-in user's live entries, newest first. */
export async function listCollection(db: UserClient, userId: string): Promise<CollectionItem[]> {
  const { data, error } = await db
    .from("entries")
    .select(COLUMNS)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`entries read failed: ${error.message}`);
  return sortCollection(data.map(itemFromRow));
}

/**
 * Adds a title to the collection. A title already there (one live entry per title) gets the new status
 * instead, keeping its id. Returns the saved item.
 */
export async function addEntry(db: UserClient, userId: string, entry: NewEntry, titleId: string): Promise<CollectionItem> {
  const columns = { status: entry.status, finished_at: entry.finishedAt };
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: existing, error: readError } = await db
      .from("entries")
      .select("id")
      .eq("user_id", userId)
      .eq("title_id", titleId)
      .is("deleted_at", null)
      .maybeSingle();
    if (readError) throw new Error(`entries read failed: ${readError.message}`);

    const { data, error } = existing
      ? await db.from("entries").update(columns).eq("id", existing.id).select(COLUMNS).single()
      : await db.from("entries").insert({ id: entry.id, title_id: titleId, ...columns }).select(COLUMNS).single();
    if (!error) return itemFromRow(data);
    // Another request added the same title in between: go again, this time as an update.
    if (error.code !== "23505") throw new Error(`entries write failed: ${error.message}`);
  }
  throw new Error("entries write failed: conflict");
}

/** Changes status / finish date, rating / review, or soft-deletes. Null when the entry isn't the user's (or is gone). */
export async function updateEntry(db: UserClient, id: string, patch: EntryPatch): Promise<CollectionItem | null> {
  const columns = patch.deleted
    ? { deleted_at: new Date().toISOString() }
    : "notes" in patch
      ? { rating: patch.notes.rating, review: patch.notes.review }
      : { status: patch.status, finished_at: patch.finishedAt };
  const { data, error } = await db
    .from("entries")
    .update(columns)
    .eq("id", id)
    .is("deleted_at", null)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`entries write failed: ${error.message}`);
  return data ? itemFromRow(data) : null;
}
