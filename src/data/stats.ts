// Rows for the stats page (S1 stats), read as the user (RLS: their own rows). The numbers themselves come
// from `statsReport` in src/core/stats/report.ts.
import { creditImageUrl, parseCredits } from "@/core/catalog/credits";
import { posterUrl } from "@/core/catalog/images";
import type { ReportPerson, ReportTitle } from "@/core/stats/report";
import type { StatsEntry, StatsEpisodeLog } from "@/core/stats/summary";
import type { Database } from "./database.types";
import { watchLogs } from "./episodes";
import { readLogs } from "./reading";
import type { StatsReadingLog } from "@/core/stats/reading";
import type { UserClient } from "./supabase-server";

const TITLE_COLUMNS =
  "id, source, kind, name, poster_path, genres, original_language, runtime_min, episode_count, page_count, chapter_count, volume_count, playtime_hours, credits";

type TitleRow = Pick<
  Database["public"]["Tables"]["titles"]["Row"],
  | "id"
  | "source"
  | "kind"
  | "name"
  | "poster_path"
  | "genres"
  | "original_language"
  | "runtime_min"
  | "episode_count"
  | "page_count"
  | "chapter_count"
  | "volume_count"
  | "playtime_hours"
  | "credits"
>;

/** A title's credits for the stats: photo URLs, and ids unique across catalogs (`tmdb:287`). */
export function reportPeople(source: string, credits: unknown): ReportPerson[] | null {
  return (
    parseCredits(credits)?.map((c) => ({ role: c.role, id: `${source}:${c.id}`, name: c.name, imageUrl: creditImageUrl(source, c.image) })) ?? null
  );
}

function titleFromRow(row: TitleRow): ReportTitle {
  return {
    id: row.id,
    kind: row.kind as ReportTitle["kind"],
    name: row.name,
    posterUrl: posterUrl(row.source, row.poster_path),
    genres: row.genres,
    originalLanguage: row.original_language,
    runtimeMin: row.runtime_min,
    episodeCount: row.episode_count,
    pageCount: row.page_count,
    chapterCount: row.chapter_count,
    volumeCount: row.volume_count,
    playtimeHours: row.playtime_hours,
    people: reportPeople(row.source, row.credits),
  };
}

export type StatsRows = { titles: ReportTitle[]; entries: StatsEntry[]; logs: StatsEpisodeLog[]; reads: StatsReadingLog[] };

/** The user's live entries (with their titles), episode logs and reading logs, plus titles reached only through logs. */
export async function statsRows(db: UserClient, userId: string): Promise<StatsRows> {
  const [{ data, error }, logs, reads] = await Promise.all([
    db
      .from("entries")
      .select(`id, title_id, status, finished_at, hours_played, title:titles!inner(${TITLE_COLUMNS})`)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(5000),
    watchLogs(db, userId),
    readLogs(db, userId),
  ]);
  if (error) throw new Error(`entries read failed: ${error.message}`);

  const titles = new Map<string, ReportTitle>();
  const entries: StatsEntry[] = data.map((row) => {
    titles.set(row.title_id, titleFromRow(row.title));
    return { id: row.id, titleId: row.title_id, status: row.status as StatsEntry["status"], finishedAt: row.finished_at, hoursPlayed: row.hours_played };
  });
  // Episodes logged on a series without a live entry still count, as in the collection summary.
  const missing = [...new Set([...logs, ...reads].map((l) => l.titleId))].filter((id) => !titles.has(id));
  for (let i = 0; i < missing.length; i += 100) {
    const { data: rows, error: titlesError } = await db.from("titles").select(TITLE_COLUMNS).in("id", missing.slice(i, i + 100));
    if (titlesError) throw new Error(`titles read failed: ${titlesError.message}`);
    for (const row of rows) titles.set(row.id, titleFromRow(row));
  }
  return { titles: [...titles.values()], entries, logs, reads };
}
