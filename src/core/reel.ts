// Reel of the Day (stage 4 daily game, ADR 0048): one movie a day for everyone, six guesses, a clue after each wrong
// one. The day is UTC, so everyone gets the same reel at the same moment. The server picks the reel, grades the
// guesses and keeps signed-in players' plays; nothing here trusts the client.
import type { CardReel } from "./cards/types";
import { localHour } from "./stats/period";
import { addDays } from "./stats/recap";

/** Guesses a player gets. */
export const REEL_GUESSES = 6;
/** Reel #1's day; every day after it is the next number. */
export const REEL_EPOCH = "2026-09-30";
/** The pool: TMDB's best-known movies (by votes), 20 a page. */
export const REEL_POOL_PAGES = 25;

const DAY_MS = 86_400_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The reel's day at `now`: the UTC date, `YYYY-MM-DD`. */
export const reelDay = (now: number): string => new Date(now).toISOString().slice(0, 10);

/** `day`'s reel number (#1 on `REEL_EPOCH`); ≤ 0 before it. */
export function reelNumber(day: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${REEL_EPOCH}T00:00:00Z`)) / DAY_MS) + 1;
}

export const isReelDay = (v: unknown): v is string => typeof v === "string" && DAY_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** A small, stable hash of a string (FNV-1a), so every server picks the same reel for a day. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The pool pages to look through for `day`'s reel, starting on the day's own page and wrapping around. */
export function reelPoolPages(day: string): number[] {
  const first = hash(`page:${day}`) % REEL_POOL_PAGES;
  return Array.from({ length: REEL_POOL_PAGES }, (_, i) => ((first + i) % REEL_POOL_PAGES) + 1);
}

/** A candidate from the pool: a TMDB movie id with a poster (the first clue). */
export type ReelCandidate = { externalId: string; hasPoster: boolean };

/** `day`'s pick among `candidates`: one with a poster that was never a reel (`used`), chosen by the day's hash. */
export function pickReel(candidates: readonly ReelCandidate[], used: ReadonlySet<string>, day: string): string | null {
  const open = candidates.filter((c) => c.hasPoster && !used.has(c.externalId)).map((c) => c.externalId);
  if (open.length === 0) return null;
  return [...open].sort()[hash(`pick:${day}`) % open.length]!;
}

/** One guess: a TMDB movie id and the name the player saw. */
export type ReelGuess = { externalId: string; name: string };

/** Guesses from a request: TMDB movie ids, each once, at most `REEL_GUESSES`. Null when malformed. */
export function parseReelGuesses(v: unknown): ReelGuess[] | null {
  if (!Array.isArray(v) || v.length > REEL_GUESSES) return null;
  const guesses: ReelGuess[] = [];
  for (const g of v) {
    if (typeof g !== "object" || g === null) return null;
    const { externalId, name } = g as Record<string, unknown>;
    if (typeof externalId !== "string" || !/^\d{1,10}$/.test(externalId)) return null;
    if (typeof name !== "string" || name.trim() === "" || name.length > 300) return null;
    if (guesses.some((x) => x.externalId === externalId)) return null;
    guesses.push({ externalId, name: name.trim() });
  }
  return guesses;
}

export type ReelGrade = {
  /** One per guess: right or wrong. Guesses after the right one are dropped. */
  results: boolean[];
  guesses: ReelGuess[];
  solved: boolean;
  /** Solved, or out of guesses: the answer can be shown. */
  done: boolean;
};

/** Grades guesses against the answer's TMDB id. */
export function gradeReel(answer: string, guesses: readonly ReelGuess[]): ReelGrade {
  const hit = guesses.findIndex((g) => g.externalId === answer);
  const kept = hit === -1 ? guesses.slice(0, REEL_GUESSES) : guesses.slice(0, hit + 1);
  const results = kept.map((g) => g.externalId === answer);
  const solved = hit !== -1;
  return { results, guesses: kept, solved, done: solved || kept.length >= REEL_GUESSES };
}

/**
 * What a signed-in player's play becomes when a device sends `sent`: the stored guesses are the truth, a device can
 * only add to them (`stored` must be a prefix of `sent`), and a finished play doesn't change. Anything else keeps
 * `stored` (the device then shows the server's play).
 */
export function mergeReelGuesses(stored: readonly ReelGuess[], sent: readonly ReelGuess[], answer: string): ReelGuess[] {
  if (gradeReel(answer, stored).done) return [...stored];
  const extends_ = sent.length >= stored.length && stored.every((g, i) => g.externalId === sent[i]!.externalId);
  return extends_ ? [...sent] : [...stored];
}

/** The clues, in the order wrong guesses reveal them. The blurred poster is there from the start. */
export const REEL_CLUES = ["year", "genre", "actor", "director", "tagline"] as const;
export type ReelClueKey = (typeof REEL_CLUES)[number];

export type ReelAnswer = {
  externalId: string;
  name: string;
  year: number | null;
  genres: readonly string[];
  /** The top-billed actor and the director (a movie's credits, stage 4). */
  actor: string | null;
  director: string | null;
  tagline: string | null;
};

export type ReelClues = Partial<Record<ReelClueKey, string | number | null>>;

/** The clues open after `wrong` wrong guesses (all of them once the play is done). A clue the movie lacks is null. */
export function reelClues(answer: ReelAnswer, wrong: number, done: boolean): ReelClues {
  const open = done ? REEL_CLUES.length : Math.min(wrong, REEL_CLUES.length);
  const value: Record<ReelClueKey, string | number | null> = {
    year: answer.year,
    genre: answer.genres.slice(0, 2).join(" · ") || null,
    actor: answer.actor,
    director: answer.director,
    tagline: answer.tagline,
  };
  return Object.fromEntries(REEL_CLUES.slice(0, open).map((key) => [key, value[key]]));
}

/** How sharp the poster is: 0 (blurred most) after no wrong guess … 6 (clear) when done. */
export const posterStep = (wrong: number, done: boolean): number => (done ? REEL_GUESSES : Math.min(wrong, REEL_GUESSES - 1));

/** The poster size served at a step: tiny while blurred, so a peek at the file shows little. */
export const posterSize = (step: number): "w92" | "w185" | "w342" => (step < 3 ? "w92" : step < REEL_GUESSES ? "w185" : "w342");

/** A finished play, for streaks and stats. */
export type ReelPlay = { day: string; solved: boolean; guesses: number };

/** The streak after finishing `day`: one more than the day before's when solved (0 when lost). */
export function streakAfter(solved: boolean, previous: { day: string; solved: boolean; streak: number } | null, day: string): number {
  if (!solved) return 0;
  return previous && previous.solved && previous.day === addDays(day, -1) ? previous.streak + 1 : 1;
}

// Reminders (ADR 0054): one push on a day whose reel would end a streak, for players who turned them on.

/** The shortest streak worth a reminder (the database's `reel_reminders_due` uses the same). */
export const REEL_REMINDER_STREAK = 2;
/** Reminders arrive between 09:00 and 21:59 on the player's clock… */
const AWAKE_FROM = 9;
const AWAKE_TO = 21;
/** …and by 21:00 UTC (the job runs a few minutes past each hour), at least 2 hours before the reel changes. */
const LAST_REMINDER_UTC_HOUR = 21;
const HOUR_MS = 3_600_000;

const awake = (instant: number, timeZone: string) => {
  const hour = localHour(instant, timeZone);
  return hour >= AWAKE_FROM && hour <= AWAKE_TO;
};

/**
 * Whether the hourly job's run at `now` is a player's reminder hour: the last hour of the reel's day, up to 21:00
 * UTC, that is daytime on their clock. So it comes late enough to matter and early enough to play: 21:00 in
 * Bangkok (the reel changes at 07:00), 17:00 in New York in summer (it changes at 20:00), 10:00 the next morning in
 * Auckland (it changes at 13:00). Unknown zones read as UTC.
 */
export function isReelReminderHour(now: number, timeZone: string): boolean {
  const hour = new Date(now).getUTCHours();
  if (hour > LAST_REMINDER_UTC_HOUR || !awake(now, timeZone)) return false;
  for (let later = hour + 1; later <= LAST_REMINDER_UTC_HOUR; later++) {
    if (awake(now + (later - hour) * HOUR_MS, timeZone)) return false;
  }
  return true;
}

/** Whole hours until the reel changes at midnight UTC (at least 1). */
export function reelHoursLeft(now: number): number {
  const end = Date.parse(`${reelDay(now)}T00:00:00Z`) + DAY_MS;
  return Math.max(1, Math.floor((end - now) / HOUR_MS));
}

export type ReelStats = {
  played: number;
  won: number;
  /** Wins in a row up to today (or yesterday, while today isn't played yet). */
  streak: number;
  maxStreak: number;
  /** Wins by guesses used: index 0 = in 1 guess. */
  distribution: number[];
};

/** A player's stats from their finished plays (any order), at `today`. */
export function reelStats(plays: readonly ReelPlay[], today: string): ReelStats {
  const sorted = [...plays].sort((a, b) => a.day.localeCompare(b.day));
  const distribution = Array.from({ length: REEL_GUESSES }, () => 0);
  let maxStreak = 0;
  let run = 0;
  let last: string | null = null;
  for (const p of sorted) {
    if (p.solved) {
      run = last !== null && addDays(last, 1) === p.day && run > 0 ? run + 1 : 1;
      distribution[Math.min(p.guesses, REEL_GUESSES) - 1]! += 1;
    } else {
      run = 0;
    }
    last = p.day;
    maxStreak = Math.max(maxStreak, run);
  }
  const lastPlay = sorted.at(-1);
  const current = lastPlay && lastPlay.solved && (lastPlay.day === today || lastPlay.day === addDays(today, -1)) ? run : 0;
  return { played: sorted.length, won: sorted.filter((p) => p.solved).length, streak: current, maxStreak, distribution };
}

/** The spoiler-free share text: "Reel of the Day #12 3/6", the squares, the streak and the link. */
export function reelShareText(card: CardReel, url: string, label: string): string {
  const squares = card.results.map((r) => (r ? "🟩" : "🟥")).join("");
  const score = card.solved ? `${card.results.length}/${REEL_GUESSES}` : `X/${REEL_GUESSES}`;
  return [`${label} #${card.number} ${score}`, squares, ...(card.streak > 0 ? [`🔥 ${card.streak}`] : []), url].join("\n");
}

/** What a player sees of the answer once the play is done. */
export type ReelReveal = { externalId: string; name: string; year: number | null; posterUrl: string | null };

/** A play as the page shows it: graded guesses, the open clues, how sharp the poster is, the answer once done. */
export type ReelState = {
  day: string;
  number: number;
  guesses: (ReelGuess & { correct: boolean })[];
  solved: boolean;
  done: boolean;
  clues: ReelClues;
  posterStep: number;
  answer: ReelReveal | null;
};

/** The state for `guesses` on `reel`. The answer's name and poster leave the server only when the play is done. */
export function reelState(reel: { day: string; answer: ReelAnswer; posterUrl: string | null }, guesses: readonly ReelGuess[]): ReelState {
  const grade = gradeReel(reel.answer.externalId, guesses);
  const wrong = grade.results.filter((r) => !r).length;
  const { externalId, name, year } = reel.answer;
  return {
    day: reel.day,
    number: reelNumber(reel.day),
    guesses: grade.guesses.map((g, i) => ({ ...g, correct: grade.results[i]! })),
    solved: grade.solved,
    done: grade.done,
    clues: reelClues(reel.answer, wrong, grade.done),
    posterStep: posterStep(wrong, grade.done),
    answer: grade.done ? { externalId, name, year, posterUrl: reel.posterUrl } : null,
  };
}

/** The card for a finished play (null while it runs). Guests have no streak (0 when solved gives 1: their first). */
export function reelCard(state: ReelState, streak: number): CardReel | null {
  if (!state.done) return null;
  return { number: state.number, day: state.day, results: state.guesses.map((g) => g.correct), solved: state.solved, streak: state.solved ? Math.max(1, streak) : 0 };
}
