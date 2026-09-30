import { posterUrl } from "@/core/catalog/images";
import { sortCollection, type CollectionItem, type EntryPatch, type EntryStatus, type NewEntry } from "@/core/collection/entries";
import { uuidv7 } from "@/core/ids";
import type { Database } from "./database.types";
import type { UserClient } from "./supabase-server";

type EntryRow = Pick<
  Database["public"]["Tables"]["entries"]["Row"],
  "id" | "status" | "finished_at" | "created_at" | "rating" | "review" | "hours_played" | "finisher_no"
>;
type TitleRow = Pick<
  Database["public"]["Tables"]["titles"]["Row"],
  | "id"
  | "source"
  | "kind"
  | "external_id"
  | "name"
  | "year"
  | "poster_path"
  | "genres"
  | "runtime_min"
  | "episode_count"
  | "page_count"
  | "chapter_count"
  | "volume_count"
  | "playtime_hours"
>;

// The entry plus the title fields a collection row shows (RLS: the signed-in user's rows).
const COLUMNS =
  "id, status, finished_at, created_at, rating, review, hours_played, finisher_no, title:titles!inner(id, source, kind, external_id, name, year, poster_path, genres, runtime_min, episode_count, page_count, chapter_count, volume_count, playtime_hours)";

function itemFromRow(row: EntryRow & { title: TitleRow }): CollectionItem {
  return {
    id: row.id,
    status: row.status as CollectionItem["status"],
    finishedAt: row.finished_at,
    addedAt: row.created_at,
    rating: row.rating,
    review: row.review,
    hoursPlayed: row.hours_played,
    finisherNo: row.finisher_no,
    title: {
      id: row.title.id,
      source: row.title.source as CollectionItem["title"]["source"],
      kind: row.title.kind as CollectionItem["title"]["kind"],
      externalId: row.title.external_id,
      name: row.title.name,
      year: row.title.year,
      posterUrl: posterUrl(row.title.source, row.title.poster_path),
      genres: row.title.genres,
      runtimeMin: row.title.runtime_min,
      episodeCount: row.title.episode_count,
      pageCount: row.title.page_count,
      chapterCount: row.title.chapter_count,
      volumeCount: row.title.volume_count,
      playtimeHours: row.title.playtime_hours,
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
 * Puts a title the user just watched or read in the collection as "watching" (a "want" entry moves on too), as a change
 * made at `at`: a status set later on another device stays (S3 offline, ADR 0042). Returns the entry's status.
 */
export async function startWatching(db: UserClient, userId: string, titleId: string, at: string): Promise<EntryStatus> {
  const { data: entry, error: entryError } = await db
    .from("entries")
    .select("id, status")
    .eq("user_id", userId)
    .eq("title_id", titleId)
    .is("deleted_at", null)
    .maybeSingle();
  if (entryError) throw new Error(`entries read failed: ${entryError.message}`);
  if (!entry) {
    const { error } = await db.from("entries").insert({ id: uuidv7(), title_id: titleId, status: "watching", finished_at: null, edited_at: at });
    if (error && error.code !== "23505") throw new Error(`entries insert failed: ${error.message}`);
    return "watching";
  }
  if (entry.status !== "want") return entry.status as EntryStatus;
  const { data: moved, error } = await db
    .from("entries")
    .update({ status: "watching", finished_at: null, edited_at: at })
    .eq("id", entry.id)
    .lte("edited_at", at)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`entries update failed: ${error.message}`);
  return moved ? "watching" : "want";
}

/**
 * A saved entry. `superseded`: the change was older than the entry's last edit (made later on another device, then
 * synced first), so it wasn't applied and `item` is what stays (S3 offline, ADR 0042).
 */
export type SavedEntry = { item: CollectionItem; superseded: boolean };

async function liveEntry(db: UserClient, id: string): Promise<CollectionItem | null> {
  const { data, error } = await db.from("entries").select(COLUMNS).eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(`entries read failed: ${error.message}`);
  return data ? itemFromRow(data) : null;
}

/**
 * Adds a title to the collection. A title already there (one live entry per title) gets the new status instead,
 * keeping its id, unless it was edited after this change was made. Returns the saved item.
 */
export async function addEntry(db: UserClient, userId: string, entry: NewEntry, titleId: string): Promise<SavedEntry> {
  const columns = { status: entry.status, finished_at: entry.finishedAt, edited_at: entry.editedAt };
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: existing, error: readError } = await db
      .from("entries")
      .select("id")
      .eq("user_id", userId)
      .eq("title_id", titleId)
      .is("deleted_at", null)
      .maybeSingle();
    if (readError) throw new Error(`entries read failed: ${readError.message}`);

    if (existing) {
      const { data, error } = await db
        .from("entries")
        .update(columns)
        .eq("id", existing.id)
        .is("deleted_at", null)
        .lte("edited_at", entry.editedAt)
        .select(COLUMNS)
        .maybeSingle();
      if (error) throw new Error(`entries write failed: ${error.message}`);
      if (data) return { item: itemFromRow(data), superseded: false };
      const current = await liveEntry(db, existing.id);
      if (current) return { item: current, superseded: true };
      continue; // removed in between: add it again
    }
    const { data, error } = await db.from("entries").insert({ id: entry.id, title_id: titleId, ...columns }).select(COLUMNS).single();
    if (!error) return { item: itemFromRow(data), superseded: false };
    // Another request added the same title in between: go again, this time as an update.
    if (error.code !== "23505") throw new Error(`entries write failed: ${error.message}`);
  }
  throw new Error("entries write failed: conflict");
}

/**
 * Changes status / finish date, rating / review (and a game's hours), or soft-deletes, unless the entry was edited after this change was
 * made (then it stays as it is: `superseded`). Null when the entry isn't the user's or is gone.
 */
export async function updateEntry(db: UserClient, id: string, patch: EntryPatch): Promise<SavedEntry | null> {
  const columns = patch.deleted
    ? { deleted_at: patch.editedAt }
    : "notes" in patch
      ? {
          rating: patch.notes.rating,
          review: patch.notes.review,
          ...(patch.notes.hoursPlayed === undefined ? {} : { hours_played: patch.notes.hoursPlayed }),
        }
      : { status: patch.status, finished_at: patch.finishedAt };
  const { data, error } = await db
    .from("entries")
    .update({ ...columns, edited_at: patch.editedAt })
    .eq("id", id)
    .is("deleted_at", null)
    .lte("edited_at", patch.editedAt)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`entries write failed: ${error.message}`);
  if (data) return { item: itemFromRow(data), superseded: false };
  const current = await liveEntry(db, id);
  return current && { item: current, superseded: true };
}
