// Weekly Recap (S1 share artwork, ADR 0025): a Monday–Sunday week in the user's time zone, its totals and
// the poster collage. Which users are due is decided in SQL (`weekly_recap_candidates`: local Monday from
// 09:00); the numbers come from `titleWatch`, so they match the collection header and the stats page.
import { RECAP_COLLAGE_MAX, type CardData, type CardRecap } from "../cards/types";
import { localDateKey, periodRange, safeTimeZone, startOfLocalDay } from "./period";
import { titleWatch, type StatsEntry, type StatsEpisodeLog, type StatsTitle } from "./summary";

/** A title as the recap needs it: stats fields plus what the collage shows. */
export type RecapTitle = StatsTitle & { name: string; posterUrl: string | null };

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function dayParts(key: string): [number, number, number] {
  const m = DAY_KEY_RE.exec(key);
  if (!m) throw new Error(`not a local date: ${key}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** `YYYY-MM-DD` plus `days` (calendar arithmetic, no time zone involved). */
export function addDays(key: string, days: number): string {
  const [y, m, d] = dayParts(key);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The recap week starting on local date `weekStart` (a Monday), as UTC instants [from, to). */
export function recapRange(weekStart: string, timeZone: string): { from: number; to: number } {
  const tz = safeTimeZone(timeZone);
  const [y, m, d] = dayParts(weekStart);
  return { from: startOfLocalDay(y, m, d, tz), to: startOfLocalDay(y, m, d + 7, tz) };
}

/** The Monday that starts the last complete week at `now` in the zone: the week a recap sent then covers. */
export function lastWeekStart(now: number, timeZone: string): string {
  const tz = safeTimeZone(timeZone);
  return localDateKey(periodRange("week", { timeZone: tz, weekStart: 1, offset: -1, now })!.from, tz);
}

/**
 * The week's recap, or null when nothing was watched. Titles are ranked by watched time (then finishes, then
 * name), and the collage keeps the top `RECAP_COLLAGE_MAX`. Rows of other weeks and deleted rows are ignored.
 */
export function weeklyRecap(
  weekStart: string,
  timeZone: string,
  titles: readonly RecapTitle[],
  entries: readonly StatsEntry[],
  episodeLogs: readonly StatsEpisodeLog[],
): CardRecap | null {
  const range = recapRange(weekStart, timeZone);
  const titleById = new Map(titles.map((t) => [t.id, t]));
  const entryByTitle = new Map(entries.filter((e) => !e.deletedAt).map((e) => [e.titleId, e]));
  const logsByTitle = new Map<string, StatsEpisodeLog[]>();
  for (const log of episodeLogs) {
    if (log.deletedAt) continue;
    const list = logsByTitle.get(log.titleId);
    if (list) list.push(log);
    else logsByTitle.set(log.titleId, [log]);
  }

  const watched: { title: RecapTitle; minutes: number; episodes: number; finished: number }[] = [];
  for (const titleId of new Set([...entryByTitle.keys(), ...logsByTitle.keys()])) {
    const title = titleById.get(titleId);
    if (!title) continue;
    const w = titleWatch(title, entryByTitle.get(titleId), logsByTitle.get(titleId) ?? [], range);
    if (w.minutes || w.episodes || w.finished) watched.push({ title, ...w });
  }
  if (watched.length === 0) return null;

  watched.sort((a, b) => b.minutes - a.minutes || b.finished - a.finished || a.title.name.localeCompare(b.title.name));
  const sum = (key: "minutes" | "episodes" | "finished") => watched.reduce((n, w) => n + w[key], 0);
  return {
    from: weekStart,
    to: addDays(weekStart, 6),
    minutes: sum("minutes"),
    episodes: sum("episodes"),
    finished: sum("finished"),
    titleCount: watched.length,
    titles: watched.slice(0, RECAP_COLLAGE_MAX).map(({ title }) => ({ name: title.name, kind: title.kind, posterUrl: title.posterUrl })),
  };
}

export type RecapFigureKey = "hours" | "minutes" | "episodes" | "finished";

/**
 * The recap's big numbers, in order: watch time (hours from 2 h, else minutes), episodes and titles finished.
 * Zeros are left out. The card and the email both use this, so they show the same figures.
 */
export function recapFigures(recap: CardRecap, hide: { time?: boolean; episodes?: boolean } = {}): { key: RecapFigureKey; value: number }[] {
  const figures: { key: RecapFigureKey; value: number }[] = [];
  if (!hide.time && recap.minutes > 0) {
    figures.push(recap.minutes >= 120 ? { key: "hours", value: Math.round(recap.minutes / 60) } : { key: "minutes", value: recap.minutes });
  }
  if (!hide.episodes && recap.episodes > 0) figures.push({ key: "episodes", value: recap.episodes });
  if (recap.finished > 0) figures.push({ key: "finished", value: recap.finished });
  return figures;
}

/** Card inputs for a recap: the top title stands in for `kind`, `name` and `posterUrl` (palette, filename). */
export function recapCardData(recap: CardRecap): CardData {
  const top = recap.titles[0];
  return {
    kind: top?.kind ?? "movie",
    name: top?.name ?? recap.from,
    posterUrl: top?.posterUrl ?? null,
    finishedOn: recap.to,
    recap,
  };
}
