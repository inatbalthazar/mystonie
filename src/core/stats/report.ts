// The stats page (S1 stats): headline numbers, activity heatmap, per-month bars, taste and records.
// Components only render this. Per-title rules are `titleWatch`'s (split into dated events here), so the
// headline equals `summarizeCollection`, i.e. the collection header, for the same period. Reading (S2 books &
// manga) follows `titleRead`: its totals equal `summarizeReading`, i.e. the Read tab's header. Games (S3 games)
// follow `titlePlay`: their totals equal `summarizePlay`, i.e. the Play tab's header.
import { RECAP_COLLAGE_MAX, type CardRecap, type StatsPeriod } from "../cards/types";
import { isReadingKind } from "../catalog/types";
import { localDateKey, periodRange, safeTimeZone } from "./period";
import { summarizePlay, titlePlay, type PlayTotals } from "./play";
import { readingEvents, sumReadEvents, summarizeReading, type ReadingSummary, type StatsReadingLog } from "./reading";
import { addDays } from "./recap";
import { summarizeCollection, type CollectionSummary, type StatsEntry, type StatsEpisodeLog, type StatsTitle } from "./summary";

export type ReportTitle = StatsTitle & {
  name: string;
  posterUrl: string | null;
  genres: readonly string[];
  /** ISO 639-1 from TMDB (`en`, `ko`, `ja`, …). */
  originalLanguage: string | null;
};

export type MonthBar = { month: string; minutes: number; finished: number };
export type Ranked = { key: string; count: number };
export type TitleRecord = { name: string; minutes: number };

export type StatsReport = {
  totals: CollectionSummary;
  /** Pages, chapters, volumes, books and manga finished, and the estimated reading time in the period. */
  reading: ReadingSummary;
  /** Games finished and their play time in the period. */
  play: PlayTotals;
  /** Days with something watched or read (local `YYYY-MM-DD` → episodes and reading logged + titles finished) in `from`–`to`. */
  heatmap: { from: string; to: string; days: Record<string, number> };
  /** The last 12 local months (`YYYY-MM`), oldest first. */
  months: MonthBar[];
  /** Watch time (reading time for books and manga, play time for games) and titles finished by kind, in the period. */
  split: {
    movie: { minutes: number; finished: number };
    series: { minutes: number; finished: number };
    reading: { minutes: number; finished: number };
    play: { minutes: number; finished: number };
  };
  /** Titles watched in the period, per genre / original language: top 5. */
  genres: Ranked[];
  languages: Ranked[];
  records: {
    /** Among movies finished in the period. */
    longestMovie: TitleRecord | null;
    /** Among series finished in the period, by their total watch time. */
    longestSeries: TitleRecord | null;
    busiestMonth: { month: string; minutes: number } | null;
    longestStreak: { days: number; from: string; to: string } | null;
  };
  /** Days in the period with something watched or read. */
  activeDays: number;
  /** The period's most watched, read or played titles (reading time for books and manga, play time for games), at most 5. */
  topTitles: { name: string; kind: ReportTitle["kind"]; posterUrl: string | null; minutes: number }[];
  /** The "Share stats" card's numbers; null when nothing was watched in the period. */
  card: CardRecap | null;
};

export type ReportOptions = {
  period: StatsPeriod;
  /** IANA zone from `profiles.time_zone`. */
  timeZone: string;
  /** 1 = Monday … 7 = Sunday (`weekStartFor(locale)`): the week period and the heatmap's columns. */
  weekStart: number;
  now: number;
};

type WatchEvent = { at: number; minutes: number; episodes: number; finished: number };

const TOP = 5;
const HEATMAP_WEEKS = 53;

/** One title's watching as dated events, by `titleWatch`'s rules: summing them over a range gives `titleWatch`. */
export function titleEvents(title: StatsTitle, entry: StatsEntry | undefined, logs: readonly StatsEpisodeLog[]): WatchEvent[] {
  const finishedAt = entry && !entry.deletedAt && entry.status === "finished" && entry.finishedAt ? Date.parse(entry.finishedAt) : null;
  const runtime = title.kind === "movie" || title.kind === "series" ? (title.runtimeMin ?? 0) : 0;
  if (title.kind !== "series") return finishedAt === null ? [] : [{ at: finishedAt, minutes: runtime, episodes: 0, finished: 1 }];

  const live = logs.filter((l) => !l.deletedAt);
  if (live.length === 0) {
    const episodes = title.episodeCount ?? 0;
    return finishedAt === null ? [] : [{ at: finishedAt, minutes: runtime * episodes, episodes, finished: 1 }];
  }
  const events = live.map((l) => ({ at: Date.parse(l.watchedAt), minutes: l.runtimeMin ?? runtime, episodes: 1, finished: 0 }));
  if (finishedAt !== null) events.push({ at: finishedAt, minutes: 0, episodes: 0, finished: 1 });
  return events;
}

/** `YYYY-MM` plus `n` months. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${String(d.getUTCFullYear()).padStart(4, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The first day of the week (`weekStart`, 1 = Monday) containing local date `key`. */
function startOfWeek(key: string, weekStart: number): string {
  const weekday = new Date(`${key}T00:00:00Z`).getUTCDay() || 7;
  return addDays(key, -((weekday - weekStart + 7) % 7));
}

function top(counts: Map<string, number>): Ranked[] {
  return [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, TOP);
}

/** Everything the stats page shows for one period. Soft-deleted rows are ignored. */
export function statsReport(
  titles: readonly ReportTitle[],
  entries: readonly StatsEntry[],
  episodeLogs: readonly StatsEpisodeLog[],
  options: ReportOptions,
  readingLogs: readonly StatsReadingLog[] = [],
): StatsReport {
  const timeZone = safeTimeZone(options.timeZone);
  const { period, now } = options;
  const range = periodRange(period, { timeZone, weekStart: options.weekStart, now });
  const totals = summarizeCollection(titles, entries, episodeLogs, range);
  const reading = summarizeReading(titles, entries, readingLogs, range);
  const play = summarizePlay(titles, entries, range);

  // Local dates through a per-hour cache: Intl formatting dominates, and logs cluster in hours. An hour whose
  // two ends fall on different local dates (zones with :30/:45 offsets) is never cached.
  const hours = new Map<number, string | null>();
  const dayOf = (t: number): string => {
    const hour = Math.floor(t / 3_600_000);
    let key = hours.get(hour);
    if (key === undefined) {
      const first = localDateKey(hour * 3_600_000, timeZone);
      key = first === localDateKey(hour * 3_600_000 + 3_599_999, timeZone) ? first : null;
      hours.set(hour, key);
    }
    return key ?? localDateKey(t, timeZone);
  };
  const inPeriod = (t: number) => !range || (t >= range.from && t < range.to);

  const today = dayOf(now);
  const heatmapFrom = startOfWeek(addDays(today, -7 * (HEATMAP_WEEKS - 1)), options.weekStart);
  const firstMonth = addMonths(today.slice(0, 7), -11);
  const months: MonthBar[] = Array.from({ length: 12 }, (_, i) => ({ month: addMonths(firstMonth, i), minutes: 0, finished: 0 }));
  const heatmapDays: Record<string, number> = {};
  const periodDays = new Set<string>();
  const monthMinutes = new Map<string, number>();
  const split = {
    movie: { minutes: 0, finished: 0 },
    series: { minutes: 0, finished: 0 },
    reading: { minutes: 0, finished: 0 },
    play: { minutes: 0, finished: 0 },
  };
  const genres = new Map<string, number>();
  const languages = new Map<string, number>();
  const watched: { title: ReportTitle; minutes: number; finished: boolean }[] = [];
  let longestMovie: TitleRecord | null = null;
  let longestSeries: TitleRecord | null = null;

  const titleById = new Map(titles.map((t) => [t.id, t]));
  const entryByTitle = new Map(entries.filter((e) => !e.deletedAt).map((e) => [e.titleId, e]));
  const logsByTitle = new Map<string, StatsEpisodeLog[]>();
  for (const log of episodeLogs) {
    const list = logsByTitle.get(log.titleId);
    if (list) list.push(log);
    else logsByTitle.set(log.titleId, [log]);
  }
  const readsByTitle = new Map<string, StatsReadingLog[]>();
  for (const log of readingLogs) {
    const list = readsByTitle.get(log.titleId);
    if (list) list.push(log);
    else readsByTitle.set(log.titleId, [log]);
  }
  const taste = (title: ReportTitle) => {
    for (const genre of new Set(title.genres)) genres.set(genre, (genres.get(genre) ?? 0) + 1);
    if (title.originalLanguage) languages.set(title.originalLanguage, (languages.get(title.originalLanguage) ?? 0) + 1);
  };

  for (const titleId of new Set([...entryByTitle.keys(), ...logsByTitle.keys(), ...readsByTitle.keys()])) {
    const title = titleById.get(titleId);
    if (!title) continue;
    if (title.kind === "game") {
      // A game: its finish marks the day, with all its play time (`titlePlay`).
      const entry = entryByTitle.get(titleId);
      const game = titlePlay(title, entry);
      if (!game.finished || !entry?.finishedAt) continue;
      const at = Date.parse(entry.finishedAt);
      const day = dayOf(at);
      if (day >= heatmapFrom && day <= today) heatmapDays[day] = (heatmapDays[day] ?? 0) + 1;
      if (!inPeriod(at)) continue;
      periodDays.add(day);
      split.play.minutes += game.minutes;
      split.play.finished += 1;
      watched.push({ title, minutes: game.minutes, finished: true });
      taste(title);
      continue;
    }
    if (isReadingKind(title.kind)) {
      // Reading: a log or a finish marks the day; the time is the estimate `titleRead` gives.
      const events = readingEvents(title, entryByTitle.get(titleId), readsByTitle.get(titleId) ?? []);
      let active = false;
      let finished = false;
      for (const e of events) {
        const day = dayOf(e.at);
        if (day >= heatmapFrom && day <= today) heatmapDays[day] = (heatmapDays[day] ?? 0) + 1;
        if (!inPeriod(e.at)) continue;
        active = true;
        finished ||= e.finished > 0;
        periodDays.add(day);
      }
      if (!active) continue;
      const minutes = sumReadEvents(events, range).minutes;
      split.reading.minutes += minutes;
      if (finished) split.reading.finished += 1;
      watched.push({ title, minutes, finished });
      taste(title);
      continue;
    }
    let total = 0;
    let minutes = 0;
    let finished = false;
    let active = false;
    for (const e of titleEvents(title, entryByTitle.get(titleId), logsByTitle.get(titleId) ?? [])) {
      total += e.minutes;
      const day = dayOf(e.at);
      if (day >= heatmapFrom && day <= today) heatmapDays[day] = (heatmapDays[day] ?? 0) + e.episodes + e.finished;
      const bar = months[(Number(day.slice(0, 4)) - Number(firstMonth.slice(0, 4))) * 12 + Number(day.slice(5, 7)) - Number(firstMonth.slice(5, 7))];
      if (bar) {
        bar.minutes += e.minutes;
        bar.finished += e.finished;
      }
      if (!inPeriod(e.at)) continue;
      active = true;
      minutes += e.minutes;
      finished ||= e.finished > 0;
      periodDays.add(day);
      monthMinutes.set(day.slice(0, 7), (monthMinutes.get(day.slice(0, 7)) ?? 0) + e.minutes);
    }
    if (!active) continue;

    watched.push({ title, minutes, finished });
    const kind = title.kind === "series" ? split.series : split.movie;
    kind.minutes += minutes;
    if (finished) kind.finished += 1;
    taste(title);
    if (!finished) continue;
    if (title.kind === "movie" && (title.runtimeMin ?? 0) > (longestMovie?.minutes ?? 0)) longestMovie = { name: title.name, minutes: title.runtimeMin! };
    if (title.kind === "series" && total > (longestSeries?.minutes ?? 0)) longestSeries = { name: title.name, minutes: total };
  }

  let busiestMonth: StatsReport["records"]["busiestMonth"] = null;
  for (const [month, minutes] of [...monthMinutes].sort(([a], [b]) => a.localeCompare(b))) {
    if (minutes > (busiestMonth?.minutes ?? 0)) busiestMonth = { month, minutes };
  }

  const days = [...periodDays].sort();
  let longestStreak: StatsReport["records"]["longestStreak"] = null;
  for (let i = 0, start = 0; i < days.length; i++) {
    if (i > 0 && addDays(days[i - 1]!, 1) !== days[i]) start = i;
    if (!longestStreak || i - start + 1 > longestStreak.days) longestStreak = { days: i - start + 1, from: days[start]!, to: days[i]! };
  }

  watched.sort((a, b) => b.minutes - a.minutes || Number(b.finished) - Number(a.finished) || a.title.name.localeCompare(b.title.name));
  const from = range ? dayOf(range.from) : days[0];
  const card: CardRecap | null =
    watched.length === 0 || !from
      ? null
      : {
          period,
          from,
          to: today < from ? from : today,
          minutes: totals.minutes,
          episodes: totals.episodes,
          finished: totals.finished,
          titleCount: watched.length,
          titles: watched.slice(0, RECAP_COLLAGE_MAX).map(({ title }) => ({ name: title.name, kind: title.kind, posterUrl: title.posterUrl })),
          ...(reading.minutes > 0 ? { readMinutes: reading.minutes } : {}),
          ...(play.minutes > 0 ? { playMinutes: play.minutes } : {}),
        };

  return {
    totals,
    reading,
    play,
    heatmap: { from: heatmapFrom, to: today, days: heatmapDays },
    months,
    split,
    genres: top(genres),
    languages: top(languages),
    records: { longestMovie, longestSeries, busiestMonth, longestStreak },
    activeDays: days.length,
    topTitles: watched.slice(0, TOP).map(({ title, minutes }) => ({ name: title.name, kind: title.kind, posterUrl: title.posterUrl, minutes })),
    card,
  };
}
