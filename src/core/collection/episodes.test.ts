import { describe, expect, it } from "vitest";
import type { Episode } from "../catalog/types";
import { airedEpisodes, nextEpisode, parseEpisodeLog, seriesComplete, seriesProgress } from "./episodes";

const ep = (season: number, episode: number, airDate: string | null = "2026-01-01"): Episode => ({
  season,
  episode,
  name: `S${season}E${episode}`,
  runtimeMin: 50,
  airDate,
});

// Two seasons of 3, a special, and one episode that airs next month.
const EPISODES = [ep(2, 1), ep(1, 1), ep(1, 2), ep(1, 3), ep(0, 1), ep(2, 2), ep(2, 3, "2026-10-20")];
const TODAY = "2026-09-28";
const refs = (...pairs: [number, number][]) => pairs.map(([season, episode]) => ({ season, episode }));

describe("airedEpisodes", () => {
  it("keeps aired, numbered seasons in order", () => {
    expect(airedEpisodes(EPISODES, TODAY).map((e) => e.name)).toEqual(["S1E1", "S1E2", "S1E3", "S2E1", "S2E2"]);
    expect(airedEpisodes([ep(1, 1, null)], TODAY)).toEqual([]);
  });
});

describe("nextEpisode", () => {
  it("starts at the first episode", () => {
    expect(nextEpisode(EPISODES, [], TODAY)?.name).toBe("S1E1");
  });

  it("is the one after the furthest logged, across seasons", () => {
    expect(nextEpisode(EPISODES, refs([1, 2]), TODAY)?.name).toBe("S1E3");
    expect(nextEpisode(EPISODES, refs([1, 1], [1, 3]), TODAY)?.name).toBe("S2E1");
    // Skipped S1E2 stays skipped: "next" moves forward.
    expect(nextEpisode(EPISODES, refs([1, 1], [1, 3], [2, 1]), TODAY)?.name).toBe("S2E2");
  });

  it("is null when caught up, and ignores episodes not out yet", () => {
    expect(nextEpisode(EPISODES, refs([2, 2]), TODAY)).toBeNull();
    expect(nextEpisode(EPISODES, refs([2, 2]), "2026-10-20")?.name).toBe("S2E3");
  });
});

describe("seriesProgress and seriesComplete", () => {
  const all = refs([1, 1], [1, 2], [1, 3], [2, 1], [2, 2]);

  it("counts logged aired episodes", () => {
    expect(seriesProgress(EPISODES, refs([1, 1], [0, 1], [2, 3]), TODAY)).toEqual({ watched: 1, aired: 5, total: 6 });
  });

  it("is complete only when the series ended and everything is out and logged", () => {
    const ended = EPISODES.filter((e) => e.airDate !== "2026-10-20");
    expect(seriesComplete(seriesProgress(ended, all, TODAY), true)).toBe(true);
    expect(seriesComplete(seriesProgress(ended, all, TODAY), false)).toBe(false); // still airing
    expect(seriesComplete(seriesProgress(EPISODES, all, TODAY), true)).toBe(false); // one to come
    expect(seriesComplete(seriesProgress(ended, all.slice(1), TODAY), true)).toBe(false);
  });
});

describe("parseEpisodeLog", () => {
  const id = "01926000-0000-7000-8000-000000000001";

  it("accepts episodes with v7 ids and drops duplicates", () => {
    expect(
      parseEpisodeLog({
        externalId: "66732",
        episodes: [
          { id, season: 1, episode: 4 },
          { id, season: 1, episode: 4 },
        ],
      }),
    ).toMatchObject({ externalId: "66732", episodes: [{ id, season: 1, episode: 4 }] });
  });

  it("keeps when they were watched: the device's time for a log made offline, else now (ADR 0042)", () => {
    const now = Date.parse("2026-09-27T20:00:00Z");
    const body = { externalId: "66732", episodes: [{ id, season: 1, episode: 1 }] };
    expect(parseEpisodeLog(body, now)?.watchedAt).toBe("2026-09-27T20:00:00.000Z");
    expect(parseEpisodeLog({ ...body, watchedAt: "2026-09-26T21:30:00Z" }, now)?.watchedAt).toBe("2026-09-26T21:30:00.000Z");
    expect(parseEpisodeLog({ ...body, watchedAt: "yesterday" }, now)).toBeNull();
  });

  it("rejects bad input", () => {
    const bad = [
      null,
      { externalId: "x", episodes: [{ id, season: 1, episode: 1 }] },
      { externalId: "1", episodes: [] },
      { externalId: "1", episodes: [{ id: "nope", season: 1, episode: 1 }] },
      { externalId: "1", episodes: [{ id, season: 0, episode: 1 }] },
      { externalId: "1", episodes: [{ id, season: 1, episode: 1.5 }] },
      { externalId: "1", episodes: Array.from({ length: 501 }, (_, i) => ({ id, season: 1, episode: i })) },
    ];
    for (const b of bad) expect(parseEpisodeLog(b)).toBeNull();
  });
});
