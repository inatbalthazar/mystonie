// Rows for the stats page (S1 stats), read as the user (RLS: their own rows). The numbers themselves come
// from `statsReport` in src/core/stats/report.ts.
import { tmdbImageUrl } from "@/core/catalog/tmdb";
import type { ReportTitle } from "@/core/stats/report";
import type { StatsEntry, StatsEpisodeLog } from "@/core/stats/summary";
import type { Database } from "./database.types";
import { watchLogs } from "./episodes";
import type { UserClient } from "./supabase-server";

const TITLE_COLUMNS = "id, kind, name, poster_path, genres, original_language, runtime_min, episode_count";

type TitleRow = Pick<
  Database["public"]["Tables"]["titles"]["Row"],
  "id" | "kind" | "name" | "poster_path" | "genres" | "original_language" | "runtime_min" | "episode_count"
>;

function titleFromRow(row: TitleRow): ReportTitle {
  return {
    id: row.id,
    kind: row.kind as ReportTitle["kind"],
    name: row.name,
    posterUrl: row.poster_path ? tmdbImageUrl(row.poster_path, "w342") : null,
    genres: row.genres,
    originalLanguage: row.original_language,
    runtimeMin: row.runtime_min,
    episodeCount: row.episode_count,
  };
}

export type StatsRows = { titles: ReportTitle[]; entries: StatsEntry[]; logs: StatsEpisodeLog[] };

/** The user's live entries (with their titles) and episode logs, plus titles reached only through logs. */
export async function statsRows(db: UserClient, userId: string): Promise<StatsRows> {
  const [{ data, error }, logs] = await Promise.all([
    db
      .from("entries")
      .select(`id, title_id, status, finished_at, title:titles!inner(${TITLE_COLUMNS})`)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(5000),
    watchLogs(db, userId),
  ]);
  if (error) throw new Error(`entries read failed: ${error.message}`);

  const titles = new Map<string, ReportTitle>();
  const entries: StatsEntry[] = data.map((row) => {
    titles.set(row.title_id, titleFromRow(row.title));
    return { id: row.id, titleId: row.title_id, status: row.status as StatsEntry["status"], finishedAt: row.finished_at };
  });
  // Episodes logged on a series without a live entry still count, as in the collection summary.
  const missing = [...new Set(logs.map((l) => l.titleId))].filter((id) => !titles.has(id));
  for (let i = 0; i < missing.length; i += 100) {
    const { data: rows, error: titlesError } = await db.from("titles").select(TITLE_COLUMNS).in("id", missing.slice(i, i + 100));
    if (titlesError) throw new Error(`titles read failed: ${titlesError.message}`);
    for (const row of rows) titles.set(row.id, titleFromRow(row));
  }
  return { titles: [...titles.values()], entries, logs };
}
