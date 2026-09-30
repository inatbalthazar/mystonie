import { tmdbSeasonNumbers, tmdbSeriesEnded } from "@/core/catalog/tmdb";
import type { Episode } from "@/core/catalog/types";
import type { EpisodeLogRequest, EpisodeRef } from "@/core/collection/episodes";
import type { EntryStatus } from "@/core/collection/entries";
import type { WatchLog } from "@/core/collection/view";
import { startWatching } from "./entries";
import { adminClient } from "./supabase-admin";
import type { UserClient } from "./supabase-server";
import { saveTitle } from "./titles";
import { seasonEpisodes, titleDetails } from "./tmdb";

const HOUR = 60 * 60 * 1000;
// Running series get new episodes; ended ones rarely change.
const TTL_RUNNING_MS = 24 * HOUR;
const TTL_ENDED_MS = 30 * 24 * HOUR;
const SEASON_CONCURRENCY = 4;

export type SeriesEpisodes = { episodes: Episode[]; ended: boolean };

type EpisodeRow = { season: number; episode: number; name: string | null; runtime_min: number | null; air_date: string | null };

const fromRow = (r: EpisodeRow): Episode => ({
  season: r.season,
  episode: r.episode,
  name: r.name,
  runtimeMin: r.runtime_min,
  airDate: r.air_date,
});

/** Runs `fn` over `items`, `limit` at a time. */
async function inBatches<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  return out;
}

/**
 * All episodes of a cached series (`titles` row `titleId`, TMDB id `externalId`), from `title_episodes`,
 * refreshed from TMDB (details + every season) when missing or old. Serves the old copy if TMDB fails;
 * throws `TmdbError` only when there's nothing cached.
 */
export async function ensureEpisodes(titleId: string, externalId: string): Promise<SeriesEpisodes> {
  const db = adminClient();
  if (!db) return { episodes: [], ended: false };

  const [{ data: title }, { data: rows }] = await Promise.all([
    db.from("titles").select("status:raw->>status").eq("id", titleId).maybeSingle(),
    db.from("title_episodes").select("season, episode, name, runtime_min, air_date, fetched_at").eq("title_id", titleId),
  ]);
  const cached = (rows ?? []).map(fromRow);
  const ended = tmdbSeriesEnded(title ?? null);
  const oldest = Math.min(...(rows ?? []).map((r) => Date.parse(r.fetched_at)));
  if (cached.length > 0 && Date.now() - oldest < (ended ? TTL_ENDED_MS : TTL_RUNNING_MS)) {
    return { episodes: cached, ended };
  }

  try {
    const details = await titleDetails("series", externalId);
    if (!details) return { episodes: cached, ended };
    await saveTitle(details.title, details.raw);
    const seasons = await inBatches(tmdbSeasonNumbers(details.raw), SEASON_CONCURRENCY, (n) => seasonEpisodes(externalId, n));
    const episodes = seasons.flat();
    const fetchedAt = new Date().toISOString();
    if (episodes.length > 0) {
      const { error } = await db.from("title_episodes").upsert(
        episodes.map((e) => ({
          title_id: titleId,
          season: e.season,
          episode: e.episode,
          name: e.name,
          runtime_min: e.runtimeMin,
          air_date: e.airDate,
          fetched_at: fetchedAt,
        })),
        { onConflict: "title_id,season,episode" },
      );
      if (error) console.error("title_episodes upsert failed", error.message);
    }
    return { episodes, ended: tmdbSeriesEnded(details.raw) };
  } catch (error) {
    if (cached.length > 0) return { episodes: cached, ended };
    throw error;
  }
}

/** Cached episodes of several series (for "Up next"), without calling TMDB. */
export async function cachedEpisodes(db: UserClient, titleIds: string[]): Promise<Map<string, Episode[]>> {
  const map = new Map<string, Episode[]>();
  if (titleIds.length === 0) return map;
  const { data, error } = await db
    .from("title_episodes")
    .select("title_id, season, episode, name, runtime_min, air_date")
    .in("title_id", titleIds)
    .limit(20000);
  if (error) throw new Error(`title_episodes read failed: ${error.message}`);
  for (const row of data) {
    const list = map.get(row.title_id) ?? [];
    list.push(fromRow(row));
    map.set(row.title_id, list);
  }
  return map;
}

export type LoggedEpisode = EpisodeRef & { id: string };

/** The user's live episode logs, per title. */
export async function episodeLogs(db: UserClient, userId: string, titleIds: string[]): Promise<Map<string, LoggedEpisode[]>> {
  const map = new Map<string, LoggedEpisode[]>();
  if (titleIds.length === 0) return map;
  const { data, error } = await db
    .from("episode_logs")
    .select("id, title_id, season, episode")
    .eq("user_id", userId)
    .in("title_id", titleIds)
    .is("deleted_at", null)
    .limit(20000);
  if (error) throw new Error(`episode_logs read failed: ${error.message}`);
  for (const row of data) {
    const list = map.get(row.title_id) ?? [];
    list.push({ id: row.id, season: row.season, episode: row.episode });
    map.set(row.title_id, list);
  }
  return map;
}

/**
 * Logs episodes (already logged ones are skipped) with the runtime of each episode, else the series'
 * typical runtime, watched at the request's time. Logging puts the series in the collection as "watching"
 * (`startWatching`). Returns every live log of the series and the entry's status.
 */
export async function logEpisodes(
  db: UserClient,
  userId: string,
  titleId: string,
  request: EpisodeLogRequest,
  runtimes: { perEpisode: Map<string, number | null>; typical: number | null },
): Promise<{ logs: LoggedEpisode[]; status: EntryStatus }> {
  const existing = (await episodeLogs(db, userId, [titleId])).get(titleId) ?? [];
  const done = new Set(existing.map((e) => `${e.season}:${e.episode}`));
  const fresh = request.episodes.filter((e) => !done.has(`${e.season}:${e.episode}`));

  if (fresh.length > 0) {
    const { error } = await db.from("episode_logs").insert(
      fresh.map((e) => ({
        id: e.id,
        title_id: titleId,
        season: e.season,
        episode: e.episode,
        runtime_min: runtimes.perEpisode.get(`${e.season}:${e.episode}`) ?? runtimes.typical,
        watched_at: request.watchedAt,
      })),
    );
    // 23505: a parallel request logged one of them first; the re-read below has it.
    if (error && error.code !== "23505") throw new Error(`episode_logs insert failed: ${error.message}`);
  }

  const status = await startWatching(db, userId, titleId, request.watchedAt);
  const logs = (await episodeLogs(db, userId, [titleId])).get(titleId) ?? [];
  return { logs, status };
}

/** Un-logs an episode (soft delete). False when it isn't the user's or is already gone. */
export async function unlogEpisode(db: UserClient, id: string): Promise<boolean> {
  const { data, error } = await db
    .from("episode_logs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`episode_logs update failed: ${error.message}`);
  return !!data;
}

/** Every live episode log of the user with its runtime and time (collection summary). */
export async function watchLogs(db: UserClient, userId: string): Promise<WatchLog[]> {
  const { data, error } = await db
    .from("episode_logs")
    .select("id, title_id, runtime_min, watched_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(20000);
  if (error) throw new Error(`episode_logs read failed: ${error.message}`);
  return data.map((r) => ({ id: r.id, titleId: r.title_id, runtimeMin: r.runtime_min, watchedAt: r.watched_at }));
}
