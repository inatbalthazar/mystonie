import { describe, expect, it } from "vitest";
import { summarizeCollection, titleWatch, type StatsEntry, type StatsEpisodeLog, type StatsTitle } from "./summary";

const titles: StatsTitle[] = [
  { id: "parasite", kind: "movie", runtimeMin: 133, episodeCount: null },
  { id: "dune", kind: "movie", runtimeMin: 166, episodeCount: null },
  { id: "arcane", kind: "series", runtimeMin: 40, episodeCount: 18 },
  { id: "chernobyl", kind: "series", runtimeMin: 65, episodeCount: 5 },
  { id: "severance", kind: "series", runtimeMin: 55, episodeCount: 19 },
  { id: "unknown-runtime", kind: "movie", runtimeMin: null, episodeCount: null },
];

const entries: StatsEntry[] = [
  { id: "e1", titleId: "parasite", status: "finished", finishedAt: "2026-09-10T20:00:00Z" },
  { id: "e2", titleId: "dune", status: "watching", finishedAt: null },
  // Marked finished without logging episodes: counts the whole series.
  { id: "e3", titleId: "chernobyl", status: "finished", finishedAt: "2026-08-20T20:00:00Z" },
  { id: "e4", titleId: "arcane", status: "watching", finishedAt: null },
  { id: "e5", titleId: "unknown-runtime", status: "finished", finishedAt: "2026-09-11T20:00:00Z" },
  { id: "e6", titleId: "dune", status: "finished", finishedAt: "2026-01-01T00:00:00Z", deletedAt: "2026-02-01T00:00:00Z" },
];

const logs: StatsEpisodeLog[] = [
  { id: "l1", titleId: "arcane", runtimeMin: 42, watchedAt: "2026-09-01T12:00:00Z" },
  { id: "l2", titleId: "arcane", runtimeMin: null, watchedAt: "2026-09-02T12:00:00Z" },
  { id: "l3", titleId: "arcane", runtimeMin: 39, watchedAt: "2026-08-31T12:00:00Z" },
  { id: "l4", titleId: "arcane", runtimeMin: 40, watchedAt: "2026-09-03T12:00:00Z", deletedAt: "2026-09-04T00:00:00Z" },
  // An episode logged without an entry still counts.
  { id: "l5", titleId: "severance", runtimeMin: 57, watchedAt: "2026-09-05T12:00:00Z" },
];

const september = { from: Date.parse("2026-09-01T00:00:00Z"), to: Date.parse("2026-10-01T00:00:00Z") };

describe("summarizeCollection", () => {
  it("counts finished titles and logged episodes, all time", () => {
    expect(summarizeCollection(titles, entries, logs)).toEqual({
      minutes: 133 + 65 * 5 + (42 + 40 + 39) + 57,
      episodes: 5 + 3 + 1,
      finished: 3,
      moviesFinished: 2,
      seriesFinished: 1,
    });
  });

  it("counts only what happened in the period", () => {
    expect(summarizeCollection(titles, entries, logs, september)).toEqual({
      minutes: 133 + (42 + 40) + 57,
      episodes: 3,
      finished: 2,
      moviesFinished: 2,
      seriesFinished: 0,
    });
  });

  it("is empty for an empty collection", () => {
    expect(summarizeCollection(titles, [], [])).toEqual({
      minutes: 0,
      episodes: 0,
      finished: 0,
      moviesFinished: 0,
      seriesFinished: 0,
    });
  });

  it("equals the sum of the rows the collection shows", () => {
    const rows = ["parasite", "dune", "chernobyl", "arcane", "unknown-runtime", "severance"].map((id) =>
      titleWatch(
        titles.find((t) => t.id === id),
        entries.find((e) => e.titleId === id && !e.deletedAt),
        logs.filter((l) => l.titleId === id),
        september,
      ),
    );
    const summary = summarizeCollection(titles, entries, logs, september);
    expect(rows.reduce((sum, r) => sum + r.minutes, 0)).toBe(summary.minutes);
    expect(rows.reduce((sum, r) => sum + r.episodes, 0)).toBe(summary.episodes);
    expect(rows.reduce((sum, r) => sum + r.finished, 0)).toBe(summary.finished);
  });
});

describe("titleWatch", () => {
  const arcane = titles.find((t) => t.id === "arcane")!;

  it("uses logged episodes for a finished series that has logs (no double counting)", () => {
    const finished: StatsEntry = { id: "e", titleId: "arcane", status: "finished", finishedAt: "2026-09-03T00:00:00Z" };
    expect(titleWatch(arcane, finished, logs.filter((l) => l.titleId === "arcane"))).toEqual({
      minutes: 42 + 40 + 39,
      episodes: 3,
      finished: 1,
    });
  });

  it("ignores statuses other than finished and deleted entries", () => {
    const movie = titles[0];
    expect(titleWatch(movie, { id: "e", titleId: "parasite", status: "want", finishedAt: null }, []).minutes).toBe(0);
    expect(
      titleWatch(movie, { id: "e", titleId: "parasite", status: "finished", finishedAt: "2026-09-10T00:00:00Z", deletedAt: "2026-09-11T00:00:00Z" }, []),
    ).toEqual({ minutes: 0, episodes: 0, finished: 0 });
  });

  it("counts a finish even when the title is missing, without minutes", () => {
    expect(titleWatch(undefined, { id: "e", titleId: "x", status: "finished", finishedAt: "2026-09-10T00:00:00Z" }, [])).toEqual({
      minutes: 0,
      episodes: 0,
      finished: 1,
    });
  });
});
