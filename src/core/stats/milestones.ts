// Milestones (S2 milestones & recaps, ADR 0031): all-time totals crossing a round number, e.g. the 100th title
// finished, 1,000 hours watched, 500 episodes. They are found by replaying `titleEvents` in time order, so the
// totals behind them are the collection's and the stats page's (`summarizeCollection` over all time).
import { MILESTONE_METRICS, type CardData, type MilestoneMetric } from "../cards/types";
import { localDateKey, safeTimeZone } from "./period";
import { titleEvents, type ReportTitle } from "./report";
import type { StatsEntry, StatsEpisodeLog } from "./summary";

/** Round numbers per metric. "hours" is watch time (reading time is an estimate, so it doesn't count). */
export const MILESTONE_THRESHOLDS: Record<MilestoneMetric, readonly number[]> = {
  titles: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  hours: [24, 100, 250, 500, 1000, 2500, 5000, 10000],
  episodes: [100, 250, 500, 1000, 2500, 5000, 10000],
};

/** A milestone reached at `reachedAt` (epoch ms) by `titleId` (the finish, episode or movie that crossed it). */
export type ReachedMilestone = { metric: MilestoneMetric; value: number; reachedAt: number; titleId: string };

/** Highest milestone announced so far per metric (`profiles.milestones_seen`). */
export type MilestonesSeen = Partial<Record<MilestoneMetric, number>>;

/** How long a milestone stays "just reached" for someone never told about that metric (a first check). */
export const MILESTONE_FRESH_MS = 2 * 86_400_000;

/**
 * Every milestone reached, oldest first. Events at the same moment are taken in title id order, so the result
 * doesn't depend on row order. Deleted rows are ignored (`titleEvents` skips them).
 */
export function reachedMilestones(
  titles: readonly Pick<ReportTitle, "id" | "kind" | "runtimeMin" | "episodeCount">[],
  entries: readonly StatsEntry[],
  episodeLogs: readonly StatsEpisodeLog[],
): ReachedMilestone[] {
  const entryByTitle = new Map(entries.filter((e) => !e.deletedAt).map((e) => [e.titleId, e]));
  const logsByTitle = new Map<string, StatsEpisodeLog[]>();
  for (const log of episodeLogs) {
    const list = logsByTitle.get(log.titleId);
    if (list) list.push(log);
    else logsByTitle.set(log.titleId, [log]);
  }
  const events: { at: number; titleId: string; minutes: number; episodes: number; finished: number }[] = [];
  for (const title of titles) {
    for (const e of titleEvents(title, entryByTitle.get(title.id), logsByTitle.get(title.id) ?? [])) events.push({ ...e, titleId: title.id });
  }
  events.sort((a, b) => a.at - b.at || a.titleId.localeCompare(b.titleId));

  // Hours are kept in minutes, so no fractions build up.
  const totals: Record<MilestoneMetric, number> = { titles: 0, hours: 0, episodes: 0 };
  const scale: Record<MilestoneMetric, number> = { titles: 1, hours: 60, episodes: 1 };
  const next: Record<MilestoneMetric, number> = { titles: 0, hours: 0, episodes: 0 };
  const reached: ReachedMilestone[] = [];
  for (const e of events) {
    totals.titles += e.finished;
    totals.hours += e.minutes;
    totals.episodes += e.episodes;
    for (const metric of MILESTONE_METRICS) {
      const thresholds = MILESTONE_THRESHOLDS[metric];
      while (next[metric] < thresholds.length && totals[metric] >= thresholds[next[metric]]! * scale[metric]) {
        reached.push({ metric, value: thresholds[next[metric]]!, reachedAt: e.at, titleId: e.titleId });
        next[metric] += 1;
      }
    }
  }
  return reached;
}

/** `profiles.milestones_seen` → the known metrics with a whole number (anything else is dropped). */
export function parseMilestonesSeen(v: unknown): MilestonesSeen {
  const seen: MilestonesSeen = {};
  if (typeof v !== "object" || v === null || Array.isArray(v)) return seen;
  for (const metric of MILESTONE_METRICS) {
    const value = (v as Record<string, unknown>)[metric];
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) seen[metric] = value;
  }
  return seen;
}

/**
 * Which milestones to celebrate now, and the new `seen`. Per metric only the highest reached one is announced
 * (crossing two at once shows the bigger), and only when it is above what was announced before. A metric never
 * announced (a first check, e.g. an existing collection) is recorded silently unless its highest milestone was
 * reached in the last `MILESTONE_FRESH_MS`. Titles first, then hours, then episodes.
 */
export function announceMilestones(
  reached: readonly ReachedMilestone[],
  seen: MilestonesSeen,
  now: number,
): { announce: ReachedMilestone[]; seen: MilestonesSeen; changed: boolean } {
  const next: MilestonesSeen = { ...seen };
  const announce: ReachedMilestone[] = [];
  let changed = false;
  for (const metric of MILESTONE_METRICS) {
    const highest = reached.filter((m) => m.metric === metric).at(-1);
    if (!highest) continue;
    const before = seen[metric];
    if (before === undefined ? now - highest.reachedAt <= MILESTONE_FRESH_MS : highest.value > before) announce.push(highest);
    if (before === undefined || highest.value > before) {
      next[metric] = highest.value;
      changed = true;
    }
  }
  return { announce, seen: next, changed };
}

/** A Milestone card's inputs: the title that crossed it stands in for name, poster and palette. */
export function milestoneCardData(
  milestone: ReachedMilestone,
  title: Pick<ReportTitle, "kind" | "name" | "posterUrl">,
  timeZone: string,
): CardData {
  return {
    kind: title.kind,
    name: title.name,
    posterUrl: title.posterUrl,
    finishedOn: localDateKey(milestone.reachedAt, safeTimeZone(timeZone)),
    milestone: { metric: milestone.metric, value: milestone.value },
  };
}
