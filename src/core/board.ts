// The board (S3 finishers & the board, ADR 0039): you and the people you follow, ranked by time spent this week or
// this month (watching plus estimated reading), then titles finished. Each person's numbers come from
// `periodRecap`, so they match the recap cards. Strava's segment leaderboard, among friends.
import type { CardRecap } from "./cards/types";
import { localDateKey, periodRange, safeTimeZone } from "./stats/period";
import type { RecapPeriod } from "./stats/recap";

export const BOARD_PERIODS = ["week", "month"] as const satisfies readonly RecapPeriod[];
export type BoardPeriod = (typeof BOARD_PERIODS)[number];

export const isBoardPeriod = (v: unknown): v is BoardPeriod => (BOARD_PERIODS as readonly unknown[]).includes(v);

/** At most this many followed people are read for the board (the most recently followed first). */
export const BOARD_PEOPLE_MAX = 200;

export type BoardPerson = { id: string; username: string; displayName: string | null; avatarUrl: string | null };

/** One line of the board. `rank` is shared on a tie ("1, 2, 2, 4"); null for the viewer with nothing yet. */
export type BoardRow = BoardPerson & {
  rank: number | null;
  me: boolean;
  /** Watch time plus estimated reading time, minutes. */
  minutes: number;
  finished: number;
  episodes: number;
};

/** The local date the current week (Monday, like recaps) or month starts on, in the viewer's time zone. */
export function boardStart(period: BoardPeriod, now: number, timeZone: string): string {
  const tz = safeTimeZone(timeZone);
  return localDateKey(periodRange(period, { timeZone: tz, weekStart: 1, now })!.from, tz);
}

const score = (recap: CardRecap | null) => ({
  minutes: recap ? recap.minutes + (recap.readMinutes ?? 0) : 0,
  finished: recap?.finished ?? 0,
  episodes: recap?.episodes ?? 0,
});

/**
 * Ranks people by time, then finishes, then episodes. People with nothing in the period are left out, except the
 * viewer, who is always on the board (last, without a rank, when they have nothing yet).
 */
export function rankBoard(people: readonly (BoardPerson & { recap: CardRecap | null })[], viewerId: string): BoardRow[] {
  const rows = people
    .map(({ recap, ...person }) => ({ ...person, ...score(recap), me: person.id === viewerId }))
    .filter((r) => r.me || r.minutes > 0 || r.finished > 0 || r.episodes > 0);
  const active = (r: (typeof rows)[number]) => r.minutes > 0 || r.finished > 0 || r.episodes > 0;
  rows.sort(
    (a, b) =>
      Number(active(b)) - Number(active(a)) ||
      b.minutes - a.minutes ||
      b.finished - a.finished ||
      b.episodes - a.episodes ||
      a.username.localeCompare(b.username),
  );
  const ranked: BoardRow[] = [];
  for (const [i, row] of rows.entries()) {
    const prev = ranked[i - 1];
    const tie = prev && prev.rank !== null && prev.minutes === row.minutes && prev.finished === row.finished && prev.episodes === row.episodes;
    ranked.push({ ...row, rank: !active(row) ? null : tie ? prev.rank : i + 1 });
  }
  return ranked;
}

/** Home's line about the board: the viewer's place among the people ranked, or null when they have none yet. */
export function boardPlace(rows: readonly BoardRow[]): { rank: number | null; of: number } {
  const of = rows.filter((r) => r.rank !== null).length;
  return { rank: rows.find((r) => r.me)?.rank ?? null, of };
}
