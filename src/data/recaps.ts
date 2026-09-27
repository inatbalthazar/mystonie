// Weekly recaps (ADR 0025). Server only: creating and notifying run with the service role from the cron route;
// reading a recap runs as the user (RLS: owners read their own).
import { tmdbImageUrl } from "@/core/catalog/tmdb";
import { parseRecap } from "@/core/cards/saved";
import type { CardRecap } from "@/core/cards/types";
import { uuidv7 } from "@/core/ids";
import { recapRange, weeklyRecap, type RecapTitle } from "@/core/stats/recap";
import type { StatsEntry, StatsEpisodeLog } from "@/core/stats/summary";
import { adminClient, type AdminClient } from "./supabase-admin";
import type { UserClient } from "./supabase-server";

export class RecapsUnavailableError extends Error {}

function admin(): AdminClient {
  const db = adminClient();
  if (!db) throw new RecapsUnavailableError("Supabase is not configured");
  return db;
}

/** A list result's rows (throws on an error). */
function check<T>(result: { data: T[] | null; error: { message: string } | null }, what: string): T[] {
  if (result.error) throw new RecapsUnavailableError(`${what} failed: ${result.error.message}`);
  return result.data ?? [];
}

/** A `maybeSingle` result's row or null (throws on an error). */
function maybe<T>(result: { data: T | null; error: { message: string } | null }, what: string): T | null {
  if (result.error) throw new RecapsUnavailableError(`${what} failed: ${result.error.message}`);
  return result.data;
}

/** One user's week, computed from their rows (a few small queries; a week of logs stays far below row limits). */
async function computeRecap(db: AdminClient, userId: string, timeZone: string, weekStart: string): Promise<CardRecap | null> {
  const range = recapRange(weekStart, timeZone);
  const from = new Date(range.from).toISOString();
  const to = new Date(range.to).toISOString();
  const [logs, entries] = await Promise.all([
    db
      .from("episode_logs")
      .select("id, title_id, runtime_min, watched_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("watched_at", from)
      .lt("watched_at", to)
      .then((r) => check(r, "episode_logs read")),
    db
      .from("entries")
      .select("id, title_id, status, finished_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("status", "finished")
      .gte("finished_at", from)
      .lt("finished_at", to)
      .then((r) => check(r, "entries read")),
  ]);
  const titleIds = [...new Set([...logs.map((l) => l.title_id), ...entries.map((e) => e.title_id)])];
  if (titleIds.length === 0) return null;
  const titles = check(
    await db.from("titles").select("id, kind, name, poster_path, runtime_min, episode_count").in("id", titleIds),
    "titles read",
  );

  // A series finished this week counts its logged episodes; only one never logged counts all of them
  // (as its Finish card does). So those need to know about logs from before the week too.
  const finishedSeries = entries.map((e) => e.title_id).filter((id) => titles.find((t) => t.id === id)?.kind === "series");
  const earlier = finishedSeries.length
    ? check(
        await db
          .from("episode_logs")
          .select("id, title_id, runtime_min, watched_at")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .in("title_id", finishedSeries)
          .lt("watched_at", from)
          .limit(1000),
        "episode_logs read",
      )
    : [];

  const recapTitles: RecapTitle[] = titles.map((t) => ({
    id: t.id,
    kind: t.kind === "series" ? "series" : "movie",
    name: t.name,
    posterUrl: t.poster_path ? tmdbImageUrl(t.poster_path, "w342") : null,
    runtimeMin: t.runtime_min,
    episodeCount: t.episode_count,
  }));
  const statsEntries: StatsEntry[] = entries.map((e) => ({ id: e.id, titleId: e.title_id, status: "finished", finishedAt: e.finished_at }));
  const statsLogs: StatsEpisodeLog[] = [...logs, ...earlier].map((l) => ({
    id: l.id,
    titleId: l.title_id,
    runtimeMin: l.runtime_min,
    watchedAt: l.watched_at,
  }));
  return weeklyRecap(weekStart, timeZone, recapTitles, statsEntries, statsLogs);
}

/**
 * Creates the recaps due at `now` (at most `limit` users per call; the hourly job picks up the rest).
 * Idempotent: a user and week that already have a recap are skipped. Returns how many were created.
 */
export async function createDueRecaps(now: Date, limit: number): Promise<number> {
  const db = admin();
  const due = check(await db.rpc("weekly_recap_candidates", { p_now: now.toISOString(), p_limit: limit }), "recap candidates");
  let created = 0;
  // A few users at a time: enough to finish well inside the route's time limit without flooding Postgres.
  for (let i = 0; i < due.length; i += 5) {
    const batch = due.slice(i, i + 5);
    const rows = await Promise.all(
      batch.map(async (u) => {
        const stats = await computeRecap(db, u.user_id, u.time_zone, u.week_start);
        return stats && { id: uuidv7(), user_id: u.user_id, week_start: u.week_start, stats };
      }),
    );
    const fresh = rows.filter((r) => r !== null);
    if (fresh.length === 0) continue;
    const inserted = check(
      await db.from("weekly_recaps").upsert(fresh, { onConflict: "user_id,week_start", ignoreDuplicates: true }).select("id"),
      "weekly_recaps write",
    );
    created += inserted.length;
  }
  return created;
}

export type RecapToNotify = { id: string; userId: string; email: string; locale: string; weekStart: string; recap: CardRecap };

/** Recaps whose email hasn't gone out yet, for people with recap emails on (oldest first). */
export async function recapsToNotify(limit: number): Promise<RecapToNotify[]> {
  const rows = check(await admin().rpc("weekly_recaps_to_notify", { p_limit: limit }), "recaps to notify");
  return rows.flatMap((r) => {
    const recap = parseRecap(r.stats);
    return recap ? [{ id: r.id, userId: r.user_id, email: r.email, locale: r.locale, weekStart: r.week_start, recap }] : [];
  });
}

export async function markRecapsNotified(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  maybe(await admin().from("weekly_recaps").update({ notified_at: new Date().toISOString() }).in("id", ids), "weekly_recaps update");
}

/** Turns recap emails off (the email's unsubscribe link; idempotent). */
export async function unsubscribeFromRecaps(userId: string): Promise<void> {
  maybe(await admin().from("profiles").update({ email_recaps: false }).eq("id", userId), "profiles update");
}

/** Remembers which card was made from a recap (the table is server-written). Best effort. */
export async function linkRecapCard(userId: string, recapId: string, cardId: string): Promise<void> {
  const db = adminClient();
  if (!db) return;
  const { error } = await db.from("weekly_recaps").update({ card_id: cardId }).eq("id", recapId).eq("user_id", userId);
  if (error) console.error("recap card link failed", error.message);
}

export type UserRecap = { id: string; weekStart: string; createdAt: string; recap: CardRecap };

const toUserRecap = (row: { id: string; week_start: string; created_at: string; stats: unknown }): UserRecap | null => {
  const recap = parseRecap(row.stats);
  return recap && { id: row.id, weekStart: row.week_start, createdAt: row.created_at, recap };
};

/** One of the signed-in user's recaps (RLS), or null. */
export async function userRecap(db: UserClient, id: string): Promise<UserRecap | null> {
  const row = maybe(await db.from("weekly_recaps").select("id, week_start, created_at, stats").eq("id", id).maybeSingle(), "weekly_recaps read");
  return row && toUserRecap(row);
}

/** The user's newest recap if it was made in the last `days` days (the collection page's "your week" note). */
export async function latestRecap(db: UserClient, userId: string, days = 7): Promise<UserRecap | null> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const row = maybe(
    await db
      .from("weekly_recaps")
      .select("id, week_start, created_at, stats")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "weekly_recaps read",
  );
  return row && toUserRecap(row);
}
