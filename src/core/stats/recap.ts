// Weekly Recap (S1 share artwork, ADR 0025) and Monthly Recap (S2 milestones & recaps, ADR 0031): a Monday–Sunday
// week or a calendar month in the user's time zone, its totals and the poster collage. Which users are due is
// decided in SQL (`weekly_recap_candidates`: local Monday from 09:00; `monthly_recap_candidates`: the local 1st
// from 09:00); the numbers come from `titleWatch`, `titleRead` and `titlePlay`, so they match the collection headers
// and the stats page.
import { RECAP_COLLAGE_MAX, type CardData, type CardRecap } from "../cards/types";
import { isReadingKind } from "../catalog/types";
import { localDateKey, periodRange, safeTimeZone, startOfLocalDay } from "./period";
import { titlePlay } from "./play";
import { titleRead, type StatsReadingLog } from "./reading";
import { titleWatch, type StatsEntry, type StatsEpisodeLog, type StatsTitle } from "./summary";

/** A title as the recap needs it: stats fields plus what the collage shows. */
export type RecapTitle = StatsTitle & { name: string; posterUrl: string | null };

/** What a recap covers. */
export type RecapPeriod = "week" | "month";

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

/** The recap period starting on local date `start` (a Monday, or the 1st for a month), as UTC instants [from, to). */
export function recapRange(start: string, timeZone: string, period: RecapPeriod = "week"): { from: number; to: number } {
  const tz = safeTimeZone(timeZone);
  const [y, m, d] = dayParts(start);
  return period === "month"
    ? { from: startOfLocalDay(y, m, 1, tz), to: startOfLocalDay(y, m + 1, 1, tz) }
    : { from: startOfLocalDay(y, m, d, tz), to: startOfLocalDay(y, m, d + 7, tz) };
}

/** The period's last local day: the Sunday after a Monday, or a month's last day. */
function lastDay(start: string, period: RecapPeriod): string {
  if (period === "week") return addDays(start, 6);
  const [y, m] = dayParts(start);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** The Monday that starts the last complete week at `now` in the zone: the week a recap sent then covers. */
export function lastWeekStart(now: number, timeZone: string): string {
  const tz = safeTimeZone(timeZone);
  return localDateKey(periodRange("week", { timeZone: tz, weekStart: 1, offset: -1, now })!.from, tz);
}

/** The 1st of the month before `now` in the zone: the month a monthly recap sent then covers. */
export function lastMonthStart(now: number, timeZone: string): string {
  const tz = safeTimeZone(timeZone);
  return localDateKey(periodRange("month", { timeZone: tz, weekStart: 1, offset: -1, now })!.from, tz);
}

/**
 * A week's or month's recap, or null when nothing was watched, read or played. Titles are ranked by time (watch
 * time, estimated reading time for books and manga, play time for games; then finishes, then name), and the collage
 * keeps the top
 * `RECAP_COLLAGE_MAX`. A monthly recap carries `period: "month"`; a weekly one has no period (ADR 0026).
 * Rows of other periods and deleted rows are ignored; reading logs must include the title's earlier logs (a log
 * counts what it adds past the furthest point before it).
 */
export function periodRecap(
  period: RecapPeriod,
  start: string,
  timeZone: string,
  titles: readonly RecapTitle[],
  entries: readonly StatsEntry[],
  episodeLogs: readonly StatsEpisodeLog[],
  readingLogs: readonly StatsReadingLog[] = [],
): CardRecap | null {
  const range = recapRange(start, timeZone, period);
  const titleById = new Map(titles.map((t) => [t.id, t]));
  const entryByTitle = new Map(entries.filter((e) => !e.deletedAt).map((e) => [e.titleId, e]));
  const group = <T extends { titleId: string; deletedAt?: string | null }>(rows: readonly T[]) => {
    const byTitle = new Map<string, T[]>();
    for (const row of rows) {
      if (row.deletedAt) continue;
      const list = byTitle.get(row.titleId);
      if (list) list.push(row);
      else byTitle.set(row.titleId, [row]);
    }
    return byTitle;
  };
  const logsByTitle = group(episodeLogs);
  const readsByTitle = group(readingLogs);

  type Watched = { title: RecapTitle; minutes: number; readMinutes: number; playMinutes: number; episodes: number; finished: number };
  const watched: Watched[] = [];
  for (const titleId of new Set([...entryByTitle.keys(), ...logsByTitle.keys(), ...readsByTitle.keys()])) {
    const title = titleById.get(titleId);
    if (!title) continue;
    const entry = entryByTitle.get(titleId);
    if (title.kind === "game") {
      const p = titlePlay(title, entry, range);
      if (p.finished) watched.push({ title, minutes: 0, readMinutes: 0, playMinutes: p.minutes, episodes: 0, finished: p.finished });
      continue;
    }
    if (isReadingKind(title.kind)) {
      const r = titleRead(title, entry, readsByTitle.get(titleId) ?? [], range);
      if (r.minutes || r.finished || r.pages || r.chapters || r.volumes) {
        watched.push({ title, minutes: 0, readMinutes: r.minutes, playMinutes: 0, episodes: 0, finished: r.finished });
      }
      continue;
    }
    const w = titleWatch(title, entry, logsByTitle.get(titleId) ?? [], range);
    if (w.minutes || w.episodes || w.finished) watched.push({ title, ...w, readMinutes: 0, playMinutes: 0 });
  }
  if (watched.length === 0) return null;

  const time = (w: Watched) => w.minutes + w.readMinutes + w.playMinutes;
  watched.sort((a, b) => time(b) - time(a) || b.finished - a.finished || a.title.name.localeCompare(b.title.name));
  const sum = (key: "minutes" | "readMinutes" | "playMinutes" | "episodes" | "finished") => watched.reduce((n, w) => n + w[key], 0);
  const readMinutes = sum("readMinutes");
  const playMinutes = sum("playMinutes");
  return {
    ...(period === "month" ? { period } : {}),
    from: start,
    to: lastDay(start, period),
    minutes: sum("minutes"),
    episodes: sum("episodes"),
    finished: sum("finished"),
    titleCount: watched.length,
    titles: watched.slice(0, RECAP_COLLAGE_MAX).map(({ title }) => ({ name: title.name, kind: title.kind, posterUrl: title.posterUrl })),
    ...(readMinutes > 0 ? { readMinutes } : {}),
    ...(playMinutes > 0 ? { playMinutes } : {}),
  };
}

/** `YYYY-MM` when the recap covers exactly one calendar month (a monthly recap), else null. */
export function wholeMonth(recap: Pick<CardRecap, "from" | "to">): string | null {
  if (!recap.from.endsWith("-01")) return null;
  return lastDay(recap.from, "month") === recap.to ? recap.from.slice(0, 7) : null;
}

/** The week's recap (`periodRecap` for the week starting on Monday `weekStart`). */
export function weeklyRecap(
  weekStart: string,
  timeZone: string,
  titles: readonly RecapTitle[],
  entries: readonly StatsEntry[],
  episodeLogs: readonly StatsEpisodeLog[],
  readingLogs: readonly StatsReadingLog[] = [],
): CardRecap | null {
  return periodRecap("week", weekStart, timeZone, titles, entries, episodeLogs, readingLogs);
}

export type RecapFigureKey = "hours" | "minutes" | "readHours" | "readMinutes" | "playHours" | "playMinutes" | "episodes" | "finished";

const TIME_KEYS = [
  ["hours", "minutes"],
  ["readHours", "readMinutes"],
  ["playHours", "playMinutes"],
] as const;

/**
 * The recap's big numbers, in order: watch time (hours from 2 h, else minutes), reading time and play time (the same
 * way), episodes and titles finished. Zeros are left out, and at most three are kept so they fit a card's row:
 * episodes give way first, then the smallest time. The card and the email both use this, so they show the same
 * figures.
 */
export function recapFigures(recap: CardRecap, hide: { time?: boolean; episodes?: boolean } = {}): { key: RecapFigureKey; value: number }[] {
  const minutes = [recap.minutes, recap.readMinutes ?? 0, recap.playMinutes ?? 0];
  let times = hide.time ? [] : [0, 1, 2].filter((i) => minutes[i]! > 0);
  // Watching, reading and playing, and titles finished: the smallest time gives way (the first of equals stays).
  if (times.length === 3 && recap.finished > 0) {
    const smallest = times.reduce((a, b) => (minutes[b]! < minutes[a]! ? b : a));
    times = times.filter((i) => i !== smallest);
  }
  const figures: { key: RecapFigureKey; value: number }[] = times.map((i) => {
    const m = minutes[i]!;
    const [hours, mins] = TIME_KEYS[i as 0 | 1 | 2];
    return m >= 120 ? { key: hours, value: Math.round(m / 60) } : { key: mins, value: m };
  });
  if (!hide.episodes && recap.episodes > 0) figures.push({ key: "episodes", value: recap.episodes });
  if (recap.finished > 0) figures.push({ key: "finished", value: recap.finished });
  return figures.length > 3 ? figures.filter((f) => f.key !== "episodes") : figures;
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
