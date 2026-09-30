// Year in Review (S2 milestones & recaps, ADR 0031): one calendar year in the user's time zone, told as album
// pages. It is `statsReport` for that year (so every number matches the stats page's "This year"), plus the
// year's first and last finish, its milestones and the shareable card's highlights.
import type { CardRecap, MilestoneMetric } from "../cards/types";
import { localDate, localDateKey, safeTimeZone, startOfLocalDay } from "./period";
import { reachedMilestones } from "./milestones";
import type { StatsReadingLog } from "./reading";
import { statsReport, type ReportTitle, type StatsReport } from "./report";
import type { StatsEntry, StatsEpisodeLog } from "./summary";

/** The earliest year a review can be asked for (older URLs are not found). */
export const FIRST_REVIEW_YEAR = 2000;

export type ReviewTitle = { name: string; kind: ReportTitle["kind"]; posterUrl: string | null };

export type YearReview = {
  year: number;
  /** False while the year is still running ("so far"). */
  complete: boolean;
  report: StatsReport;
  /** The year's first and last finished titles, with their local finish dates. */
  firstFinish: (ReviewTitle & { on: string }) | null;
  lastFinish: (ReviewTitle & { on: string }) | null;
  /** Milestones reached during the year, oldest first. */
  milestones: { metric: MilestoneMetric; value: number; on: string; title: ReviewTitle }[];
  /** The Year in Review card; null when nothing was watched or read that year. */
  card: CardRecap | null;
};

/** The user's current local year. */
export function currentYear(now: number, timeZone: string): number {
  return localDate(now, safeTimeZone(timeZone)).year;
}

/**
 * Whether a year can be reviewed at `now`: from `FIRST_REVIEW_YEAR` to the current local year. The current year
 * is reviewable all along (its page says "so far"); Home only points to it from December 1.
 */
export function isReviewYear(year: number, now: number, timeZone: string): boolean {
  return Number.isInteger(year) && year >= FIRST_REVIEW_YEAR && year <= currentYear(now, timeZone);
}

/** Home's Year in Review note: the year it points to at `now`, i.e. this year in December, last year in January. */
export function reviewSeasonYear(now: number, timeZone: string): number | null {
  const { year, month } = localDate(now, safeTimeZone(timeZone));
  return month === 12 ? year : month === 1 ? year - 1 : null;
}

/** One year in review. `now` bounds a running year (the report counts up to it). */
export function yearInReview(
  titles: readonly ReportTitle[],
  entries: readonly StatsEntry[],
  episodeLogs: readonly StatsEpisodeLog[],
  readingLogs: readonly StatsReadingLog[],
  options: { year: number; timeZone: string; weekStart: number; now: number },
): YearReview {
  const timeZone = safeTimeZone(options.timeZone);
  const from = startOfLocalDay(options.year, 1, 1, timeZone);
  const to = startOfLocalDay(options.year + 1, 1, 1, timeZone);
  const complete = options.now >= to;
  // The report's period is "the year containing `now`": for a past year, its last instant.
  const at = Math.min(options.now, to - 1);
  const report = statsReport(titles, entries, episodeLogs, { period: "year", timeZone, weekStart: options.weekStart, now: at }, readingLogs);

  const titleById = new Map(titles.map((t) => [t.id, t]));
  const show = (id: string): ReviewTitle | null => {
    const t = titleById.get(id);
    return t ? { name: t.name, kind: t.kind, posterUrl: t.posterUrl } : null;
  };
  const finishes = entries
    .filter((e) => !e.deletedAt && e.status === "finished" && e.finishedAt)
    .map((e) => ({ at: Date.parse(e.finishedAt!), titleId: e.titleId }))
    .filter((e) => e.at >= from && e.at < to && titleById.has(e.titleId))
    .sort((a, b) => a.at - b.at || a.titleId.localeCompare(b.titleId));
  const bookend = (e: (typeof finishes)[number] | undefined) => (e ? { ...show(e.titleId)!, on: localDateKey(e.at, timeZone) } : null);

  const milestones = reachedMilestones(titles, entries, episodeLogs)
    .filter((m) => m.reachedAt >= from && m.reachedAt < to && titleById.has(m.titleId))
    .map((m) => ({ metric: m.metric, value: m.value, on: localDateKey(m.reachedAt, timeZone), title: show(m.titleId)! }));

  const { genres, records } = report;
  const card: CardRecap | null = report.card && {
    ...report.card,
    from: `${options.year}-01-01`,
    // A running year ends today on its card ("Jan 1 – Dec 5, 2026").
    to: complete ? `${options.year}-12-31` : report.card.to,
    highlights: {
      ...(genres[0] ? { genre: genres[0].key } : {}),
      ...(records.busiestMonth ? { month: records.busiestMonth.month } : {}),
      ...(records.longestStreak && records.longestStreak.days > 1 ? { streak: records.longestStreak.days } : {}),
    },
  };

  return { year: options.year, complete, report, firstFinish: bookend(finishes[0]), lastFinish: bookend(finishes.at(-1)), milestones, card };
}
