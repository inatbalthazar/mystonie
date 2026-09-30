// Play time (S3 games, ADR 0044): games finished and the hours they took. The player's own hours when they gave them
// (asked after the celebration), else RAWG's average playtime, an estimate the UI labels as such. A game counts on
// its finish date, all at once, as a movie counts its runtime. Like `titleWatch` and `titleRead`, one function per
// title feeds the Play tab's header, its rows, the stats page and the recaps, so they agree for the same period.
// Play time stays out of watch time, the hours milestones, the hours challenge and the board: a 60-hour game
// finished on a Sunday would swamp a week of watching.
import { inRange, type TimeRange } from "./period";
import type { StatsEntry, StatsTitle } from "./summary";

export type PlayTotals = {
  /** Play time, minutes. */
  minutes: number;
  /** Games finished in the range. */
  finished: number;
};

const EMPTY: PlayTotals = { minutes: 0, finished: 0 };

/** The hours a finished game counts for: the player's own, else RAWG's average, else none. */
export function playHours(title: Pick<StatsTitle, "playtimeHours">, entry: Pick<StatsEntry, "hoursPlayed">): number {
  return entry.hoursPlayed ?? title.playtimeHours ?? 0;
}

/** What one game adds to the play totals in `range` (all time without one). Zero for every other kind. */
export function titlePlay(title: StatsTitle | undefined, entry: StatsEntry | undefined, range: TimeRange = null): PlayTotals {
  if (title?.kind !== "game" || !entry || entry.deletedAt || entry.status !== "finished" || !inRange(entry.finishedAt, range)) {
    return { ...EMPTY };
  }
  return { minutes: playHours(title, entry) * 60, finished: 1 };
}

/** Play totals across a collection: the sum of `titlePlay` over every game with a live entry. */
export function summarizePlay(titles: readonly StatsTitle[], entries: readonly StatsEntry[], range: TimeRange = null): PlayTotals {
  const titleById = new Map(titles.map((t) => [t.id, t]));
  const totals = { ...EMPTY };
  for (const entry of entries) {
    const play = titlePlay(titleById.get(entry.titleId), entry, range);
    totals.minutes += play.minutes;
    totals.finished += play.finished;
  }
  return totals;
}
