// Public profiles and account data export (S1 profile & privacy, ADR 0027). Server only.
import { collectPages } from "@/core/account";
import { posterUrl } from "@/core/catalog/images";
import type { UserClient } from "./supabase-server";

export type PublicProfile =
  | { isPrivate: true; username: string }
  | {
      isPrivate: false;
      id: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
      joinedAt: string;
    };

/** The safe subset of a profile by username (`public_profile()`), or null when nobody has that name. */
export async function publicProfile(db: UserClient, username: string): Promise<PublicProfile | null> {
  const { data, error } = await db.rpc("public_profile", { p_username: username });
  if (error) throw new Error(`public_profile failed: ${error.message}`);
  // Generated types say non-null; a private profile returns nulls for everything but the name.
  const row = data[0] as
    | { id: string | null; username: string; display_name: string | null; avatar_url: string | null; is_private: boolean; created_at: string | null }
    | undefined;
  if (!row) return null;
  if (row.is_private || !row.id || !row.created_at) return { isPrivate: true, username: row.username };
  return {
    isPrivate: false,
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    joinedAt: row.created_at,
  };
}

export type WatchingTitle = { id: string; kind: string; name: string; posterUrl: string | null };

/** What a public profile is watching now, most recently touched first. */
export async function currentlyWatching(db: UserClient, userId: string, limit: number): Promise<WatchingTitle[]> {
  const { data, error } = await db
    .from("entries")
    .select("title:titles!inner(id, source, kind, name, poster_path)")
    .eq("user_id", userId)
    .eq("status", "watching")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`entries read failed: ${error.message}`);
  return data.map(({ title }) => ({
    id: title.id,
    kind: title.kind,
    name: title.name,
    posterUrl: posterUrl(title.source, title.poster_path),
  }));
}

/**
 * Everything the user has stored with us, as they can read it (RLS: their own rows, deleted ones included),
 * for Settings → Export my data (GDPR/PDPA/CCPA). Each table is read in pages, so nothing is cut off at the
 * API's row limit.
 */
export async function exportAccount(db: UserClient, user: { id: string; email: string | undefined; createdAt: string }) {
  const table = <T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) =>
    collectPages(async (from, to) => {
      const { data, error } = await read(from, to);
      if (error) throw new Error(`export read failed: ${error.message}`);
      return data ?? [];
    });

  const [profile, entries, episodeLogs, readingLogs, cards, weeklyRecaps] = await Promise.all([
    db
      .from("profiles")
      .select("username, display_name, avatar_url, locale, time_zone, country, visibility, theme, email_recaps, created_at, updated_at")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error) throw new Error(`export read failed: ${error.message}`);
        return data;
      }),
    table((from, to) =>
      db
        .from("entries")
        .select("id, status, finished_at, rating, review, created_at, updated_at, deleted_at, title:titles(source, kind, external_id, name, year)")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    table((from, to) =>
      db
        .from("episode_logs")
        .select("id, season, episode, runtime_min, watched_at, created_at, updated_at, deleted_at, title:titles(source, kind, external_id, name)")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    table((from, to) =>
      db
        .from("reading_logs")
        .select("id, unit, position, read_at, created_at, updated_at, deleted_at, title:titles(source, kind, external_id, name)")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    table((from, to) =>
      db
        .from("cards")
        .select("id, kind, entry_id, episode_log_id, reading_log_id, template_id, size, params, image_path, shared_at, created_at, updated_at, deleted_at")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    table((from, to) =>
      db
        .from("weekly_recaps")
        .select("id, week_start, stats, card_id, notified_at, created_at")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
  ]);

  return {
    format: "mystonie-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email ?? null, createdAt: user.createdAt },
    profile,
    entries,
    episodeLogs,
    readingLogs,
    cards,
    weeklyRecaps,
  };
}
