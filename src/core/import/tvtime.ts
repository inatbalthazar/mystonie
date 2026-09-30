// TV Time GDPR export → shows (with every episode seen) and movies to import (S3 import & export, ADR 0041). TV Time
// closed in July 2026; people kept the ZIP of CSVs its GDPR self-service gave them. The files that matter, over
// the export's generations (column names vary, so each is read from any of its known names):
//   tracking-prod-records-v2.csv, tracking-prod-records.csv
//     movies: movie_name, type (watch | rewatch | follow | towatch), created_at | watch_date | updated_at, release_date
//     episodes: series_name, season_number | s_no, episode_number | ep_no, created_at | watch_date | updated_at,
//               series_id | s_id (TheTVDB's id)
//   seen_episode.csv (older): tv_show_name, episode_season_number, episode_number, created_at | updated_at, tv_show_id
//   followed_tv_show.csv, user_tv_show_data.csv: tv_show_name, tv_show_id (shows followed, maybe none seen yet)
// The same ZIP holds tokens, IP addresses and device data: only the files above are ever opened.
import { csvRecords } from "./csv";
import {
  capItems,
  capLogs,
  dateOf,
  importItem,
  momentOf,
  nameOf,
  splitYear,
  type ImportEpisode,
  type ImportItem,
  type ParsedImport,
} from "./items";

export const TVTIME_FILES = [
  "tracking-prod-records-v2.csv",
  "tracking-prod-records.csv",
  "seen_episode.csv",
  "followed_tv_show.csv",
  "user_tv_show_data.csv",
] as const;

const baseName = (path: string) => path.replace(/\\/g, "/").split("/").pop()!.toLowerCase();

/** Whether a path (anywhere in the ZIP) is one of the TV Time files we read. */
export const isTvTimeFile = (path: string) => (TVTIME_FILES as readonly string[]).includes(baseName(path));

const first = (row: Record<string, string>, ...keys: string[]) => keys.map((k) => row[k]?.trim()).find((v) => v) ?? "";
const number = (v: string, min: number) => {
  const n = Number(v);
  return v !== "" && Number.isInteger(n) && n >= min && n <= 32767 ? n : null;
};
const tvdbOf = (v: string) => (/^\d{1,10}$/.test(v) && v !== "0" ? v : null);

type Show = { name: string; year: number | null; tvdbId: string | null; episodes: Map<string, ImportEpisode>; followed: boolean };
type Movie = { name: string; year: number | null; watchedAt: string | null; want: boolean };

/**
 * The export's shows and movies. A show with seen episodes is "watching" (saving finishes it when every episode is
 * seen and it has ended); a show only followed, or a movie only followed or saved for later, is "want". Specials
 * (season 0) are left out, as everywhere in Mystonie. Null when none of the files is a TV Time file.
 */
export function parseTvTime(files: readonly { path: string; text: string }[]): ParsedImport | null {
  const ours = files.filter((f) => isTvTimeFile(f.path));
  if (ours.length === 0) return null;
  const shows = new Map<string, Show>();
  const movies = new Map<string, Movie>();

  const show = (rawName: string, id: string): Show | null => {
    const tidy = nameOf(rawName);
    if (!tidy) return null;
    const { name, year } = splitYear(tidy);
    const key = tidy.toLowerCase();
    let s = shows.get(key);
    if (!s) {
      s = { name, year, tvdbId: null, episodes: new Map(), followed: false };
      shows.set(key, s);
    }
    s.tvdbId ??= tvdbOf(id);
    return s;
  };
  const seen = (s: Show, season: number | null, episode: number | null, at: string | null) => {
    if (season === null || season < 1 || episode === null || episode < 1 || !at) return;
    const key = `${season}:${episode}`;
    const had = s.episodes.get(key);
    if (!had || at > had.watchedAt) s.episodes.set(key, { season, episode, watchedAt: at });
  };

  for (const file of ours) {
    const kind = baseName(file.path);
    for (const row of csvRecords(file.text)) {
      const at = momentOf(first(row, "created_at", "watch_date", "updated_at"));
      if (kind.startsWith("tracking-prod-records")) {
        const type = first(row, "type").toLowerCase();
        const movieName = nameOf(first(row, "movie_name"));
        if (movieName) {
          const { name, year: named } = splitYear(movieName);
          const released = dateOf(first(row, "release_date"));
          const year = named ?? (released ? Number(released.slice(0, 4)) : null);
          const key = `${name.toLowerCase()}\u0000${year ?? ""}`;
          const m = movies.get(key) ?? { name, year, watchedAt: null, want: false };
          movies.set(key, m);
          if (type === "watch" || type === "rewatch" || type === "") {
            if (at && (!m.watchedAt || at > m.watchedAt)) m.watchedAt = at;
          } else if (type === "follow" || type === "towatch") m.want = true;
          continue;
        }
        if (type.startsWith("count-")) continue;
        const s = show(first(row, "series_name", "tv_show_name"), first(row, "series_id", "s_id", "tv_show_id"));
        if (!s) continue;
        const episode = number(first(row, "episode_number", "ep_no"), 0);
        if (episode === null) s.followed = true;
        else seen(s, number(first(row, "season_number", "s_no", "episode_season_number"), 0), episode, at);
      } else if (kind === "seen_episode.csv") {
        const s = show(first(row, "tv_show_name", "series_name"), first(row, "tv_show_id", "series_id"));
        if (s) seen(s, number(first(row, "episode_season_number", "season_number"), 0), number(first(row, "episode_number"), 0), at);
      } else {
        const s = show(first(row, "tv_show_name", "series_name"), first(row, "tv_show_id", "series_id"));
        if (s) s.followed = true;
      }
    }
  }

  const items: ImportItem[] = [];
  for (const s of shows.values()) {
    const episodes = capLogs([...s.episodes.values()], (e) => e.watchedAt);
    items.push(
      importItem({
        key: `tvtime:show:${s.name.toLowerCase()}:${s.year ?? ""}`,
        name: s.name,
        year: s.year,
        find: "series",
        query: { by: "show", name: s.name, year: s.year, tvdbId: s.tvdbId },
        status: episodes.length > 0 ? "watching" : "want",
        episodes,
      }),
    );
  }
  for (const m of movies.values()) {
    if (!m.watchedAt && !m.want) continue;
    items.push(
      importItem({
        key: `tvtime:movie:${m.name.toLowerCase()}:${m.year ?? ""}`,
        name: m.name,
        year: m.year,
        find: "movie",
        query: { by: "film", name: m.name, year: m.year },
        status: m.watchedAt ? "finished" : "want",
        finishedAt: m.watchedAt,
      }),
    );
  }
  return { source: "tvtime", ...capItems(items) };
}
