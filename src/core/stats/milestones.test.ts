import { describe, expect, it } from "vitest";
import { parseCardSave } from "../cards/saved";
import { announceMilestones, MILESTONE_FRESH_MS, milestoneCardData, parseMilestonesSeen, reachedMilestones } from "./milestones";
import type { ReportTitle } from "./report";
import { summarizeCollection, type StatsEntry, type StatsEpisodeLog } from "./summary";

const title = (id: string, kind: ReportTitle["kind"], runtimeMin: number | null, episodeCount: number | null = null): ReportTitle => ({
  id,
  kind,
  name: id.toUpperCase(),
  posterUrl: null,
  genres: [],
  originalLanguage: null,
  runtimeMin,
  episodeCount,
});

const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString();

// Twelve movies of 2 h finished one a day, then a 100-episode series of 50 min logged on day 20.
const movies = Array.from({ length: 12 }, (_, i) => title(`m${String(i).padStart(2, "0")}`, "movie", 120));
const series = title("show", "series", 50, 100);
const book = title("book", "book", null);
const titles = [...movies, series, book];
const entries: StatsEntry[] = [
  ...movies.map((m, i) => ({ id: `e${i}`, titleId: m.id, status: "finished" as const, finishedAt: day(i) })),
  { id: "eb", titleId: "book", status: "finished", finishedAt: day(30) },
  { id: "es", titleId: "show", status: "watching", finishedAt: null },
];
const logs: StatsEpisodeLog[] = Array.from({ length: 100 }, (_, i) => ({ id: `l${i}`, titleId: "show", runtimeMin: null, watchedAt: day(20) }));

describe("reachedMilestones", () => {
  const reached = reachedMilestones(titles, entries, logs);

  it("finds the 10th title, the 24th and 100th hour and the 100th episode, when and by what", () => {
    expect(reached).toEqual([
      { metric: "titles", value: 10, reachedAt: Date.parse(day(9)), titleId: "m09" },
      // 12 movies = 24 h exactly: the 12th movie crosses it.
      { metric: "hours", value: 24, reachedAt: Date.parse(day(11)), titleId: "m11" },
      // 24 h + 100 × 50 min = 107 h 20 min: the 92nd episode reaches 100 h (all logged the same moment).
      { metric: "hours", value: 100, reachedAt: Date.parse(day(20)), titleId: "show" },
      { metric: "episodes", value: 100, reachedAt: Date.parse(day(20)), titleId: "show" },
    ]);
  });

  it("uses the collection's totals: books count as titles, not hours", () => {
    const total = summarizeCollection(titles, entries, logs);
    expect(total.finished).toBe(13);
    expect(total.minutes).toBe(12 * 120 + 100 * 50);
    expect(reached.filter((m) => m.metric === "titles").map((m) => m.value)).toEqual([10]);
  });

  it("ignores deleted rows and a series finished without logs counts all its episodes", () => {
    const gone = entries.map((e) => (e.titleId === "m00" ? { ...e, deletedAt: day(40) } : e));
    expect(reachedMilestones(titles, gone, []).find((m) => m.metric === "titles")).toMatchObject({ titleId: "m10" });
    const binge = reachedMilestones([series], [{ id: "x", titleId: "show", status: "finished", finishedAt: day(3) }], []);
    expect(binge.map((m) => `${m.metric}:${m.value}`)).toEqual(["hours:24", "episodes:100"]);
  });
});

describe("announceMilestones", () => {
  const reached = reachedMilestones(titles, entries, logs);
  const now = Date.parse(day(20)) + 3_600_000;

  it("announces the highest new one per metric, once", () => {
    const first = announceMilestones(reached, { titles: 10, hours: 24, episodes: 0 }, now);
    expect(first.announce.map((m) => `${m.metric}:${m.value}`)).toEqual(["hours:100", "episodes:100"]);
    expect(first.seen).toEqual({ titles: 10, hours: 100, episodes: 100 });
    expect(first.changed).toBe(true);
    const again = announceMilestones(reached, first.seen, now + 60_000);
    expect(again).toEqual({ announce: [], seen: first.seen, changed: false });
  });

  it("records an existing collection silently, but still celebrates one just reached", () => {
    const later = Date.parse(day(20)) + MILESTONE_FRESH_MS + 1;
    const quiet = announceMilestones(reached, {}, later);
    expect(quiet.announce).toEqual([]);
    expect(quiet.seen).toEqual({ titles: 10, hours: 100, episodes: 100 });
    expect(announceMilestones(reached, {}, now).announce.map((m) => m.metric)).toEqual(["hours", "episodes"]);
  });

  it("doesn't go back after entries are deleted", () => {
    expect(announceMilestones(reached.slice(0, 1), { titles: 25 }, now)).toEqual({ announce: [], seen: { titles: 25 }, changed: false });
  });

  it("reads profiles.milestones_seen defensively", () => {
    expect(parseMilestonesSeen({ titles: 100, hours: "x", episodes: -1, other: 5 })).toEqual({ titles: 100 });
    expect(parseMilestonesSeen(null)).toEqual({});
    expect(parseMilestonesSeen([1])).toEqual({});
  });
});

describe("Milestone cards", () => {
  it("are saved as `milestone` cards with the title that did it", () => {
    const [tenth] = reachedMilestones(titles, entries, logs);
    const data = milestoneCardData(tenth!, { kind: "movie", name: "Parasite", posterUrl: null }, "Asia/Bangkok");
    expect(data).toEqual({ kind: "movie", name: "Parasite", posterUrl: null, finishedOn: "2026-01-10", milestone: { metric: "titles", value: 10 } });
    const card = { id: "01926000-0000-7000-8000-000000000001", kind: "milestone", templateId: "stone", size: "story", data };
    expect(parseCardSave(card)).toMatchObject({ kind: "milestone", data: { milestone: { metric: "titles", value: 10 } } });
    expect(parseCardSave({ ...card, templateId: "boldStats" })).not.toBeNull();
    expect(parseCardSave({ ...card, kind: "sticker", templateId: "sticker" })).not.toBeNull();
    for (const bad of [
      { ...card, templateId: "polaroid" },
      { ...card, data: { ...data, milestone: null } },
      { ...card, data: { ...data, milestone: { metric: "pages", value: 10 } } },
      { ...card, data: { ...data, milestone: { metric: "titles", value: 0 } } },
      { ...card, entryId: "01926000-0000-7000-8000-000000000002" },
      { ...card, kind: "finish", entryId: "01926000-0000-7000-8000-000000000002", templateId: "ticket" },
    ]) {
      expect(parseCardSave(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});
