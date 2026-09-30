// A week's or month's activity of several people at once, as recaps (`periodRecap`): the weekly and monthly recap
// job (one person, service role) and the board (the viewer and the people they follow, read as the viewer, so RLS
// leaves out private and blocked profiles). Server only.
import { posterUrl } from "@/core/catalog/images";
import type { TitleKind } from "@/core/catalog/types";
import type { CardRecap } from "@/core/cards/types";
import type { ReadingUnit } from "@/core/collection/reading";
import { periodRecap, recapRange, type RecapPeriod, type RecapTitle } from "@/core/stats/recap";
import type { StatsReadingLog } from "@/core/stats/reading";
import type { StatsEntry, StatsEpisodeLog } from "@/core/stats/summary";
import type { AdminClient } from "./supabase-admin";
import type { UserClient } from "./supabase-server";

type Db = AdminClient | UserClient;

/** PostgREST returns at most this many rows per request (`max_rows`). */
const PAGE = 1000;
const MAX_PAGES = 20;
/** People per query, so `in (...)` stays short. */
const CHUNK = 50;

export class ActivityReadError extends Error {}

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Every row of a query, page by page (`range` pages of `PAGE`). */
async function allRows<T>(query: (from: number, to: number) => Page<T>, what: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await query(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new ActivityReadError(`${what} failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

const chunks = <T>(list: readonly T[], size: number): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/**
 * Each person's recap of the period starting on local date `start` in `timeZone` (null: nothing in it). People whose
 * rows the client can't read (private, blocked) simply have none.
 */
export async function periodRecaps(
  db: Db,
  userIds: readonly string[],
  period: RecapPeriod,
  start: string,
  timeZone: string,
): Promise<Map<string, CardRecap | null>> {
  const range = recapRange(start, timeZone, period);
  const from = new Date(range.from).toISOString();
  const to = new Date(range.to).toISOString();
  const out = new Map<string, CardRecap | null>(userIds.map((id) => [id, null]));

  for (const ids of chunks([...new Set(userIds)], CHUNK)) {
    const [logs, entries, reads] = await Promise.all([
      allRows(
        (a, b) =>
          db
            .from("episode_logs")
            .select("id, user_id, title_id, runtime_min, watched_at")
            .in("user_id", ids)
            .is("deleted_at", null)
            .gte("watched_at", from)
            .lt("watched_at", to)
            .order("id")
            .range(a, b),
        "episode_logs read",
      ),
      allRows(
        (a, b) =>
          db
            .from("entries")
            .select("id, user_id, title_id, finished_at, hours_played")
            .in("user_id", ids)
            .is("deleted_at", null)
            .eq("status", "finished")
            .gte("finished_at", from)
            .lt("finished_at", to)
            .order("id")
            .range(a, b),
        "entries read",
      ),
      allRows(
        (a, b) =>
          db
            .from("reading_logs")
            .select("id, user_id, title_id")
            .in("user_id", ids)
            .is("deleted_at", null)
            .gte("read_at", from)
            .lt("read_at", to)
            .order("id")
            .range(a, b),
        "reading_logs read",
      ),
    ]);
    const titleIds = [...new Set([...logs, ...entries, ...reads].map((r) => r.title_id))];
    if (titleIds.length === 0) continue;
    const titles = (
      await Promise.all(
        chunks(titleIds, 100).map((part) =>
          allRows(
            (a, b) =>
              db
                .from("titles")
                .select("id, source, kind, name, poster_path, runtime_min, episode_count, page_count, chapter_count, volume_count, playtime_hours")
                .in("id", part)
                .order("id")
                .range(a, b),
            "titles read",
          ),
        ),
      )
    ).flat();
    const kindOf = new Map(titles.map((t) => [t.id, t.kind]));

    // A series finished in the period counts its logged episodes; only one never logged counts all of them (as its
    // Finish card does). So those need to know about logs from before the period too.
    const finishedSeries = [...new Set(entries.map((e) => e.title_id).filter((id) => kindOf.get(id) === "series"))];
    // Reading counts checkpoints: a log adds what it moves past the furthest point before it, and a finish adds the
    // rest. So the earlier logs of the books and manga read or finished in the period are needed too.
    const readTitles = titleIds.filter((id) => kindOf.get(id) === "book" || kindOf.get(id) === "manga");
    const [earlier, allReads] = await Promise.all([
      finishedSeries.length
        ? allRows(
            (a, b) =>
              db
                .from("episode_logs")
                .select("id, user_id, title_id, runtime_min, watched_at")
                .in("user_id", ids)
                .in("title_id", finishedSeries)
                .is("deleted_at", null)
                .lt("watched_at", from)
                .order("id")
                .range(a, b),
            "episode_logs read",
          )
        : [],
      readTitles.length
        ? allRows(
            (a, b) =>
              db
                .from("reading_logs")
                .select("id, user_id, title_id, unit, position, read_at")
                .in("user_id", ids)
                .in("title_id", readTitles)
                .is("deleted_at", null)
                .lt("read_at", to)
                .order("id")
                .range(a, b),
            "reading_logs read",
          )
        : [],
    ]);

    const recapTitles: RecapTitle[] = titles.map((t) => ({
      id: t.id,
      kind: t.kind as TitleKind,
      name: t.name,
      posterUrl: posterUrl(t.source, t.poster_path),
      runtimeMin: t.runtime_min,
      episodeCount: t.episode_count,
      pageCount: t.page_count,
      chapterCount: t.chapter_count,
      volumeCount: t.volume_count,
      playtimeHours: t.playtime_hours,
    }));
    for (const userId of ids) {
      const mine = <T extends { user_id: string }>(rows: readonly T[]) => rows.filter((r) => r.user_id === userId);
      const statsEntries: StatsEntry[] = mine(entries).map((e) => ({
        id: e.id,
        titleId: e.title_id,
        status: "finished",
        finishedAt: e.finished_at,
        hoursPlayed: e.hours_played,
      }));
      const statsLogs: StatsEpisodeLog[] = [...mine(logs), ...mine(earlier)].map((l) => ({
        id: l.id,
        titleId: l.title_id,
        runtimeMin: l.runtime_min,
        watchedAt: l.watched_at,
      }));
      const readingLogs: StatsReadingLog[] = mine(allReads).map((r) => ({
        id: r.id,
        titleId: r.title_id,
        unit: r.unit as ReadingUnit,
        position: r.position,
        readAt: r.read_at,
      }));
      if (statsEntries.length + statsLogs.length + readingLogs.length === 0) continue;
      out.set(userId, periodRecap(period, start, timeZone, recapTitles, statsEntries, statsLogs, readingLogs));
    }
  }
  return out;
}
