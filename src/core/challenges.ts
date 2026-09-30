// Monthly challenges (S3 challenges & clubs, ADR 0040): Strava's monthly challenges for what you finish, watch and
// read. Each calendar month has a lineup (a themed challenge for that month plus three that come back every month),
// defined here in code. Progress counts everything in the month in the user's time zone, from the 1st, even from
// before they joined. The server evaluates and records it (`challenge_joins`); nothing here trusts the client.
import type { CardChallenge, CardData } from "./cards/types";
import { localDate, localDateKey, safeTimeZone } from "./stats/period";
import { periodRecap, recapRange, type RecapTitle } from "./stats/recap";
import type { StatsReadingLog } from "./stats/reading";
import type { StatsEntry, StatsEpisodeLog } from "./stats/summary";
import { fitsFilter, genreKeys, GENRES, type TasteTitle, type TitleFilter } from "./taste";

export type ChallengeRule =
  /** Finish `target` titles that pass the filter (any title without one). */
  | { type: "finish"; target: number; filter?: TitleFilter }
  /** Finish titles in `target` different original languages, or of `target` different kinds. */
  | { type: "distinct"; target: number; of: "language" | "kind" }
  /** Spend `target` hours watching and reading (the recap cards' time, reading estimated). */
  | { type: "hours"; target: number }
  /** Log something (a finish, an episode, a reading checkpoint) on `target` different days. */
  | { type: "days"; target: number };

export type Challenge = { slug: string; rule: ChallengeRule };

/** Back every month, after the month's themed one. */
const EVERY_MONTH = [
  { slug: "finish-four", rule: { type: "finish", target: 4 } },
  { slug: "twenty-hours", rule: { type: "hours", target: 20 } },
  { slug: "twelve-days", rule: { type: "days", target: 12 } },
] as const satisfies readonly Challenge[];

/** One themed challenge per calendar month, January first. Seasons differ by hemisphere, so none are seasonal. */
const THEMED = [
  { slug: "new-chapter", rule: { type: "finish", target: 2, filter: { kinds: ["book", "manga"] } } },
  { slug: "love-stories", rule: { type: "finish", target: 3, filter: { genres: GENRES.romance } } },
  { slug: "world-tour", rule: { type: "distinct", target: 3, of: "language" } },
  { slug: "laugh-lines", rule: { type: "finish", target: 3, filter: { genres: GENRES.comedy } } },
  { slug: "anime-month", rule: { type: "finish", target: 3, filter: { kinds: ["movie", "series"], genres: GENRES.animation, languages: ["ja"] } } },
  { slug: "movie-marathon", rule: { type: "finish", target: 5, filter: { kinds: ["movie"] } } },
  { slug: "out-of-this-world", rule: { type: "finish", target: 3, filter: { genres: [...GENRES.scifi, ...GENRES.fantasy] } } },
  { slug: "box-set", rule: { type: "finish", target: 2, filter: { kinds: ["series"] } } },
  { slug: "case-files", rule: { type: "finish", target: 3, filter: { genres: GENRES.mystery } } },
  { slug: "fright-month", rule: { type: "finish", target: 3, filter: { genres: GENRES.horror } } },
  { slug: "kdrama-month", rule: { type: "finish", target: 2, filter: { kinds: ["series"], languages: ["ko"] } } },
  { slug: "triple-threat", rule: { type: "distinct", target: 3, of: "kind" } },
] as const satisfies readonly Challenge[];

/** Every slug a lineup can hold (messages and patch art have one entry each). */
export const CHALLENGE_SLUGS = [...THEMED.map((c) => c.slug), ...EVERY_MONTH.map((c) => c.slug)] as const;
export type ChallengeSlug = (typeof CHALLENGE_SLUGS)[number];

const SLUGS: ReadonlySet<string> = new Set(CHALLENGE_SLUGS);
export const isChallengeSlug = (value: unknown): value is ChallengeSlug => typeof value === "string" && SLUGS.has(value);

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** A calendar month, `YYYY-MM`. */
export const isMonth = (value: unknown): value is string => typeof value === "string" && MONTH_RE.test(value);

/** The month's lineup: its themed challenge first, then the three of every month. */
export function monthChallenges(month: string): Challenge[] {
  const m = MONTH_RE.exec(month);
  if (!m) return [];
  return [THEMED[Number(m[2]) - 1]!, ...EVERY_MONTH];
}

/** The challenge `slug` of `month`'s lineup, or null. */
export function findChallenge(month: string, slug: unknown): Challenge | null {
  return monthChallenges(month).find((c) => c.slug === slug) ?? null;
}

/** The month (`YYYY-MM`) `now` falls in, in the zone. */
export const currentMonth = (now: number, timeZone: string): string => localDateKey(now, timeZone).slice(0, 7);

/** `YYYY-MM` → the `date` column's value, `YYYY-MM-01`. */
export const monthDate = (month: string): string => `${month}-01`;

/** Days left in the month, today included (1 on its last day). */
export function daysLeft(month: string, now: number, timeZone: string): number {
  const tz = safeTimeZone(timeZone);
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const today = localDate(now, tz);
  if (today.year !== y || today.month !== m) return 0;
  return last - today.day + 1;
}

/** What a challenge counts, for its label ("2 of 4 titles"). */
export type ChallengeUnit = "titles" | "languages" | "kinds" | "hours" | "days";

export function challengeUnit(rule: ChallengeRule): ChallengeUnit {
  if (rule.type === "finish") return "titles";
  if (rule.type === "distinct") return rule.of === "language" ? "languages" : "kinds";
  return rule.type;
}

/** A title as challenges need it: its kind, genres and language, plus what recaps count time with. */
export type ChallengeTitle = RecapTitle & TasteTitle;

export type ChallengeRows = {
  titles: readonly ChallengeTitle[];
  entries: readonly StatsEntry[];
  logs: readonly StatsEpisodeLog[];
  reads: readonly StatsReadingLog[];
};

/** One challenge's standing in a month: how far along (capped at `target`), and when and by which title it was met. */
export type ChallengeProgress = { slug: string; target: number; value: number; done: boolean; doneAt: number | null; titleId: string | null };

type Event = { at: number; titleId: string };

/**
 * Every challenge of `month`'s lineup, from the user's rows (their whole collection, or at least the month and the
 * logs before it that recaps need), plus the days of the month with something logged (the challenge card's
 * calendar). Finishes, episodes and reading logs count from the 1st to the last day, local time.
 */
export function evaluateChallenges(month: string, timeZone: string, rows: ChallengeRows): { progress: ChallengeProgress[]; days: number[] } {
  const lineup = monthChallenges(month);
  if (lineup.length === 0) return { progress: [], days: [] };
  const tz = safeTimeZone(timeZone);
  const start = monthDate(month);
  const range = recapRange(start, tz, "month");
  const inMonth = (iso: string | null | undefined) => {
    if (!iso) return null;
    const at = Date.parse(iso);
    return at >= range.from && at < range.to ? at : null;
  };
  const byOrder = (a: Event, b: Event) => a.at - b.at || a.titleId.localeCompare(b.titleId);

  const titleById = new Map(rows.titles.map((t) => [t.id, t]));
  const finishes: (Event & { title: ChallengeTitle; genres: string[] })[] = [];
  const events: Event[] = [];
  for (const e of rows.entries) {
    if (e.deletedAt || e.status !== "finished") continue;
    const at = inMonth(e.finishedAt);
    const title = titleById.get(e.titleId);
    if (at === null || !title) continue;
    finishes.push({ at, titleId: title.id, title, genres: genreKeys(title.genres) });
    events.push({ at, titleId: title.id });
  }
  for (const l of [...rows.logs, ...rows.reads]) {
    if (l.deletedAt) continue;
    const at = inMonth("watchedAt" in l ? l.watchedAt : l.readAt);
    if (at !== null) events.push({ at, titleId: l.titleId });
  }
  finishes.sort(byOrder);
  events.sort(byOrder);

  // The calendar: which days of the month had something logged.
  const dayOf = (at: number) => localDate(at, tz).day;
  const days = [...new Set(events.map((e) => dayOf(e.at)))].sort((a, b) => a - b);
  const latest = events.at(-1) ?? null;

  const progress = lineup.map(({ slug, rule }): ChallengeProgress => {
    const result: ChallengeProgress = { slug, target: rule.target, value: 0, done: false, doneAt: null, titleId: null };
    const reach = (value: number, event: Event | null) => {
      result.value = Math.max(result.value, Math.min(value, rule.target));
      if (!result.done && value >= rule.target) {
        result.done = true;
        result.doneAt = event?.at ?? null;
        result.titleId = event?.titleId ?? null;
      }
    };
    if (rule.type === "finish") {
      let count = 0;
      for (const f of finishes) if (!rule.filter || fitsFilter(rule.filter, f.title, f.genres)) reach(++count, f);
    } else if (rule.type === "distinct") {
      const seen = new Set<string>();
      for (const f of finishes) {
        const key = rule.of === "kind" ? f.title.kind : f.title.originalLanguage?.toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        reach(seen.size, f);
      }
    } else if (rule.type === "days") {
      const seen = new Set<number>();
      for (const e of events) {
        const day = dayOf(e.at);
        if (seen.has(day)) continue;
        seen.add(day);
        reach(seen.size, e);
      }
    } else {
      // Time has no single moment it was reached; the latest thing logged in the month stands for it.
      const recap = periodRecap("month", start, tz, rows.titles, rows.entries, rows.logs, rows.reads);
      reach(Math.floor(((recap?.minutes ?? 0) + (recap?.readMinutes ?? 0)) / 60), latest);
    }
    return result;
  });
  return { progress, days };
}

/**
 * The Challenge card's inputs for a completed challenge: the title whose save completed it (its poster), the day it
 * was completed, and the month's calendar.
 */
export function challengeCardData(
  challenge: { slug: string; target: number },
  month: string,
  days: readonly number[],
  title: { kind: CardData["kind"]; name: string; posterUrl: string | null } | null,
  doneOn: string,
): CardData {
  const card: CardChallenge = { slug: challenge.slug, month, target: challenge.target, days: [...days] };
  return {
    kind: title?.kind ?? "movie",
    name: title?.name ?? challenge.slug,
    posterUrl: title?.posterUrl ?? null,
    finishedOn: doneOn,
    challenge: card,
  };
}

/** POST /api/challenges `{ month, slug, join }`: a challenge of that month's lineup. */
export function parseChallengeToggle(body: unknown): { month: string; slug: ChallengeSlug; on: boolean } | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { month, slug, join } = body as Record<string, unknown>;
  if (!isMonth(month) || !isChallengeSlug(slug) || typeof join !== "boolean" || !findChallenge(month, slug)) return null;
  return { month, slug, on: join };
}
