// Badges, drawn as stickers (S3 badges & shelf, ADR 0038): earned from what you finish, and since ADR 0063 also from
// the Reel of the Day, monthly challenges, the warnings quiz, writing and supporting Mystonie. The catalogue is data
// in code; each rule is checked by replaying the user's finishes (or activity) in time order, so a badge knows when
// it was earned and which finish earned it. The server evaluates and awards (`user_badges`); nothing here trusts the
// client.
import type { TitleKind } from "./catalog/types";
import { localDateKey, safeTimeZone } from "./stats/period";
import { addDays } from "./stats/recap";
import type { StatsEntry } from "./stats/summary";
import { fitsFilter, genreKeys, GENRES } from "./taste";

export type BadgeRule =
  /** `target` finishes matching every filter given (any of its kinds, any of its genres, any of its languages). */
  | { type: "count"; target: number; kinds?: readonly TitleKind[]; genres?: readonly string[]; languages?: readonly string[] }
  /** Finishes spanning `target` different original languages, genres or kinds. */
  | { type: "distinct"; target: number; of: "language" | "genre" | "kind" }
  /** `target` finishes of these kinds on one local day. */
  | { type: "sameDay"; target: number; kinds: readonly TitleKind[] }
  /** `target` Reels of the Day solved (in at most `maxGuesses` guesses). */
  | { type: "reel"; target: number; maxGuesses?: number }
  /** `target` Reels of the Day solved on days in a row. */
  | { type: "reelStreak"; target: number }
  /** Monthly challenges completed: `target` of them, in `target` different months, or `target` in one month. */
  | { type: "challenges"; target: number; of: "all" | "months" | "oneMonth" }
  /** `target` of something done: counted warnings-quiz answers, reviews, Journal articles, support (Pro or a tip). */
  | { type: "times"; target: number; of: "quiz" | "reviews" | "articles" | "support" };

/** The catalogue, in the order the sticker album shows it: firsts, then how much, then taste, then range. */
export const BADGES = [
  { id: "first-movie", rule: { type: "count", target: 1, kinds: ["movie"] } },
  { id: "first-series", rule: { type: "count", target: 1, kinds: ["series"] } },
  { id: "first-book", rule: { type: "count", target: 1, kinds: ["book"] } },
  { id: "first-manga", rule: { type: "count", target: 1, kinds: ["manga"] } },
  { id: "first-game", rule: { type: "count", target: 1, kinds: ["game"] } },
  { id: "film-buff", rule: { type: "count", target: 25, kinds: ["movie"] } },
  { id: "binge-master", rule: { type: "count", target: 10, kinds: ["series"] } },
  { id: "rookie-bookworm", rule: { type: "count", target: 5, kinds: ["book"] } },
  { id: "bookworm", rule: { type: "count", target: 25, kinds: ["book"] } },
  { id: "manga-marathon", rule: { type: "count", target: 10, kinds: ["manga"] } },
  { id: "level-up", rule: { type: "count", target: 10, kinds: ["game"] } },
  { id: "triple-feature", rule: { type: "sameDay", target: 3, kinds: ["movie"] } },
  { id: "kdrama-fan", rule: { type: "count", target: 5, kinds: ["series"], languages: ["ko"] } },
  { id: "anime-fan", rule: { type: "count", target: 10, kinds: ["movie", "series"], genres: GENRES.animation, languages: ["ja"] } },
  { id: "fear-conqueror", rule: { type: "count", target: 10, genres: GENRES.horror } },
  { id: "laugh-track", rule: { type: "count", target: 10, genres: GENRES.comedy } },
  { id: "stargazer", rule: { type: "count", target: 10, genres: GENRES.scifi } },
  { id: "hopeless-romantic", rule: { type: "count", target: 10, genres: GENRES.romance } },
  { id: "sleuth", rule: { type: "count", target: 10, genres: GENRES.mystery } },
  { id: "subtitles-on", rule: { type: "distinct", target: 5, of: "language" } },
  { id: "genre-hopper", rule: { type: "distinct", target: 10, of: "genre" } },
  { id: "all-rounder", rule: { type: "distinct", target: 4, of: "kind" } },
  // Reel of the Day (ADR 0063), easiest first; the last one is a month without a miss.
  { id: "reel-rookie", rule: { type: "reel", target: 1 } },
  { id: "one-take", rule: { type: "reel", target: 1, maxGuesses: 1 } },
  { id: "sharp-eye", rule: { type: "reel", target: 10, maxGuesses: 3 } },
  { id: "hot-streak", rule: { type: "reelStreak", target: 7 } },
  { id: "reel-legend", rule: { type: "reelStreak", target: 30 } },
  // Monthly challenges: the first, every challenge of one month (all four), six different months.
  { id: "challenger", rule: { type: "challenges", target: 1, of: "all" } },
  { id: "clean-sweep", rule: { type: "challenges", target: 4, of: "oneMonth" } },
  { id: "season-pass", rule: { type: "challenges", target: 6, of: "months" } },
  // Helping others with the warnings quiz (answers that count: not "don't remember", not too fast).
  { id: "lookout", rule: { type: "times", target: 10, of: "quiz" } },
  { id: "guardian", rule: { type: "times", target: 100, of: "quiz" } },
  // Writing: reviews on finishes, articles in the Journal (the article's `profile` is the writer's username).
  { id: "critic", rule: { type: "times", target: 10, of: "reviews" } },
  { id: "byline", rule: { type: "times", target: 1, of: "articles" } },
  // Supporting Mystonie: Pro, or a Buy Me a Coffee tip with the account's email.
  { id: "supporter", rule: { type: "times", target: 1, of: "support" } },
] as const satisfies readonly { id: string; rule: BadgeRule }[];

export type BadgeId = (typeof BADGES)[number]["id"];

const BADGE_IDS: ReadonlySet<string> = new Set(BADGES.map((b) => b.id));
export const isBadgeId = (value: unknown): value is BadgeId => typeof value === "string" && BADGE_IDS.has(value);

/** How long a badge counts as "just earned" when it is awarded on someone's first check (an existing collection). */
export const BADGE_FRESH_MS = 2 * 86_400_000;

export type BadgeTitle = { id: string; kind: TitleKind; genres: readonly string[]; originalLanguage: string | null };

/** One badge's standing: how far along (capped at `target`), and when and by which title's finish it was earned. */
export type BadgeProgress = { id: BadgeId; target: number; progress: number; earnedAt: number | null; titleId: string | null };

type Finish = { at: number; title: BadgeTitle; genres: string[] };

/** What earns badges beside finishes (ADR 0063), all the user's own rows, times in ms. */
export type BadgeActivity = {
  /** Finished Reel of the Day plays: the reel's UTC day, whether solved, guesses used, when the play ended. */
  reel: readonly { day: string; solved: boolean; guesses: number; at: number }[];
  /** Completed monthly challenges: the month (`YYYY-MM`) and when. */
  challenges: readonly { month: string; at: number }[];
  /** When each counted warnings-quiz answer was given. */
  quiz: readonly number[];
  /** When each finish with a review was finished. */
  reviews: readonly number[];
  /** The dates of the published Journal articles they wrote. */
  articles: readonly number[];
  /** When they supported Mystonie (a Pro subscription that was paid for). */
  support: readonly number[];
};

export const NO_ACTIVITY: BadgeActivity = { reel: [], challenges: [], quiz: [], reviews: [], articles: [], support: [] };

const matches = (rule: Extract<BadgeRule, { type: "count" }>, f: Finish): boolean => fitsFilter(rule, f.title, f.genres);

/**
 * Every badge in catalogue order, from the user's live finishes (entries `finished` with a date) replayed oldest
 * first; finishes at the same moment are taken in title id order, so row order doesn't matter. `timeZone` decides
 * what "one day" is for same-day badges. The other badges come from `activity` (none without it); they have no title.
 */
export function evaluateBadges(
  titles: readonly BadgeTitle[],
  entries: readonly StatsEntry[],
  timeZone: string,
  activity: BadgeActivity = NO_ACTIVITY,
): BadgeProgress[] {
  const zone = safeTimeZone(timeZone);
  const titleById = new Map(titles.map((t) => [t.id, t]));
  const finishes: Finish[] = [];
  for (const e of entries) {
    if (e.deletedAt || e.status !== "finished" || !e.finishedAt) continue;
    const title = titleById.get(e.titleId);
    const at = Date.parse(e.finishedAt);
    if (!title || Number.isNaN(at)) continue;
    finishes.push({ at, title, genres: genreKeys(title.genres) });
  }
  finishes.sort((a, b) => a.at - b.at || a.title.id.localeCompare(b.title.id));
  const plays = [...activity.reel].sort((a, b) => a.day.localeCompare(b.day));
  const completed = [...activity.challenges].sort((a, b) => a.at - b.at);

  return (BADGES as readonly { id: BadgeId; rule: BadgeRule }[]).map(({ id, rule }): BadgeProgress => {
    const result: BadgeProgress = { id, target: rule.target, progress: 0, earnedAt: null, titleId: null };
    const reach = (value: number, at: number, titleId: string | null) => {
      result.progress = Math.max(result.progress, Math.min(value, rule.target));
      if (result.earnedAt === null && value >= rule.target) {
        result.earnedAt = at;
        result.titleId = titleId;
      }
    };
    const earn = (value: number, f: Finish) => reach(value, f.at, f.title.id);
    if (rule.type === "reel") {
      let count = 0;
      for (const p of plays) if (p.solved && p.guesses <= (rule.maxGuesses ?? Infinity)) reach(++count, p.at, null);
    } else if (rule.type === "reelStreak") {
      let run = 0;
      let last: string | null = null;
      for (const p of plays) {
        run = p.solved ? (last !== null && run > 0 && addDays(last, 1) === p.day ? run + 1 : 1) : 0;
        last = p.day;
        if (run > 0) reach(run, p.at, null);
      }
    } else if (rule.type === "challenges") {
      const perMonth = new Map<string, number>();
      for (const [i, c] of completed.entries()) {
        perMonth.set(c.month, (perMonth.get(c.month) ?? 0) + 1);
        reach(rule.of === "all" ? i + 1 : rule.of === "months" ? perMonth.size : perMonth.get(c.month)!, c.at, null);
      }
    } else if (rule.type === "times") {
      const times = [...activity[rule.of]].sort((a, b) => a - b);
      for (const [i, at] of times.entries()) reach(i + 1, at, null);
    } else if (rule.type === "count") {
      let count = 0;
      for (const f of finishes) if (matches(rule, f)) earn(++count, f);
    } else if (rule.type === "distinct") {
      const seen = new Set<string>();
      for (const f of finishes) {
        const keys = rule.of === "kind" ? [f.title.kind] : rule.of === "genre" ? f.genres : f.title.originalLanguage ? [f.title.originalLanguage.toLowerCase()] : [];
        const before = seen.size;
        for (const key of keys) seen.add(key);
        if (seen.size > before) earn(seen.size, f);
      }
    } else if (rule.type === "sameDay") {
      const perDay = new Map<string, number>();
      for (const f of finishes) {
        if (!rule.kinds.includes(f.title.kind)) continue;
        const day = localDateKey(f.at, zone);
        const count = (perDay.get(day) ?? 0) + 1;
        perDay.set(day, count);
        earn(count, f);
      }
    }
    return result;
  });
}

export type EarnedBadge = { id: BadgeId; earnedAt: number; titleId: string | null };

/** A badge to announce in the app ("New sticker"), with the name of the title whose finish earned it. */
export type BadgeNews = { id: BadgeId; titleName: string | null };

/** One spot in the sticker album: earned (with when and by which title) or still to earn (with progress). */
export type AlbumBadge = { id: BadgeId; target: number; progress: number; earnedAt: string | null; titleName: string | null };

/**
 * The album in catalogue order. An awarded badge stays earned whatever the collection says now (awards are never
 * taken back), with its stored date; one earned but not awarded yet (no service role) shows as earned too.
 */
export function albumBadges(
  progress: readonly BadgeProgress[],
  awarded: readonly { id: BadgeId; earnedAt: string; titleName: string | null }[],
  titleName: (titleId: string) => string | null,
): AlbumBadge[] {
  const stored = new Map(awarded.map((b) => [b.id, b]));
  return progress.map((p) => {
    const s = stored.get(p.id);
    if (s) return { id: p.id, target: p.target, progress: p.target, earnedAt: s.earnedAt, titleName: s.titleName };
    if (p.earnedAt !== null) return { id: p.id, target: p.target, progress: p.target, earnedAt: new Date(p.earnedAt).toISOString(), titleName: p.titleId ? titleName(p.titleId) : null };
    return { id: p.id, target: p.target, progress: p.progress, earnedAt: null, titleName: null };
  });
}

/** The earned badges not awarded yet, oldest first. */
export function badgesToAward(progress: readonly BadgeProgress[], awarded: ReadonlySet<string>): EarnedBadge[] {
  return progress
    .flatMap((b) => (b.earnedAt !== null && !awarded.has(b.id) ? [{ id: b.id, earnedAt: b.earnedAt, titleId: b.titleId }] : []))
    .sort((a, b) => a.earnedAt - b.earnedAt);
}

/**
 * Which of the badges just awarded to celebrate. Someone who already had badges has been checked before, so every
 * new one is news. On a first check (an existing collection meeting the feature) only those earned in the last
 * `BADGE_FRESH_MS` are; the rest are stuck in the album quietly.
 */
export function badgesToCelebrate(awarded: readonly EarnedBadge[], hadBadges: boolean, now: number): EarnedBadge[] {
  return hadBadges ? [...awarded] : awarded.filter((b) => now - b.earnedAt <= BADGE_FRESH_MS);
}
