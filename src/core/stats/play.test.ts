import { describe, expect, it } from "vitest";
import type { CollectionItem } from "../collection/entries";
import { collectionRows, summarizePlayRows, summarizeRows, yearRange } from "../collection/view";
import { reachedMilestones } from "./milestones";
import { periodRange } from "./period";
import { playHours, summarizePlay, titlePlay } from "./play";
import { periodRecap, recapFigures } from "./recap";
import { statsReport, type ReportTitle } from "./report";
import { summarizeCollection } from "./summary";

// A game finished with the player's hours, one finished with only RAWG's average, one with neither, one still being
// played, and a movie (which must stay out of the play numbers).
const game = (id: string, name: string, playtimeHours: number | null): CollectionItem["title"] => ({
  id,
  source: "rawg",
  kind: "game",
  externalId: id.replace(/\D/g, "") || "1",
  name,
  year: 2020,
  posterUrl: null,
  playtimeHours,
  genres: ["RPG"],
});
const ITEMS: CollectionItem[] = [
  { id: "e1", status: "finished", finishedAt: "2026-09-20T12:00:00Z", addedAt: "2026-08-01T00:00:00Z", hoursPlayed: 187, title: game("g3328", "The Witcher 3", 43) },
  { id: "e2", status: "finished", finishedAt: "2026-09-05T12:00:00Z", addedAt: "2026-09-01T00:00:00Z", title: game("g22511", "Tears of the Kingdom", 61) },
  { id: "e3", status: "finished", finishedAt: "2025-12-01T12:00:00Z", addedAt: "2025-11-01T00:00:00Z", title: game("g1", "Pong", null) },
  { id: "e4", status: "watching", finishedAt: null, addedAt: "2026-09-10T00:00:00Z", hoursPlayed: null, title: game("g2", "Elden Ring", 55) },
  {
    id: "e5",
    status: "finished",
    finishedAt: "2026-09-10T12:00:00Z",
    addedAt: "2026-09-10T00:00:00Z",
    title: { id: "parasite", source: "tmdb", kind: "movie", externalId: "496243", name: "Parasite", year: 2019, posterUrl: null, runtimeMin: 133, genres: [] },
  },
];

const TZ = "UTC";
const titles: ReportTitle[] = ITEMS.map(({ title }) => ({
  id: title.id!,
  kind: title.kind,
  name: title.name,
  posterUrl: null,
  genres: title.genres ?? [],
  originalLanguage: null,
  runtimeMin: title.runtimeMin ?? null,
  episodeCount: null,
  playtimeHours: title.playtimeHours ?? null,
}));
const entries = ITEMS.map((i) => ({ id: i.id, titleId: i.title.id!, status: i.status, finishedAt: i.finishedAt, hoursPlayed: i.hoursPlayed ?? null }));

describe("titlePlay", () => {
  it("counts the player's own hours, else RAWG's average, on the finish date", () => {
    expect(titlePlay(titles[0], entries[0])).toEqual({ minutes: 187 * 60, finished: 1 });
    expect(titlePlay(titles[1], entries[1])).toEqual({ minutes: 61 * 60, finished: 1 });
    // Neither known: the finish counts, with no time.
    expect(titlePlay(titles[2], entries[2])).toEqual({ minutes: 0, finished: 1 });
    expect(playHours({ playtimeHours: 43 }, { hoursPlayed: null })).toBe(43);
  });

  it("counts nothing for a game still being played, outside the range, removed, or not a game", () => {
    expect(titlePlay(titles[3], entries[3])).toEqual({ minutes: 0, finished: 0 });
    expect(titlePlay(titles[0], entries[0], yearRange(2025, TZ))).toEqual({ minutes: 0, finished: 0 });
    expect(titlePlay(titles[0], { ...entries[0]!, deletedAt: "2026-09-21T00:00:00Z" })).toEqual({ minutes: 0, finished: 0 });
    expect(titlePlay(titles[4], entries[4])).toEqual({ minutes: 0, finished: 0 });
  });
});

describe("play totals agree everywhere", () => {
  it("the Play tab's header equals summarizePlay, per year, and the tab holds only games", () => {
    for (const year of [null, 2025, 2026]) {
      const rows = collectionRows(ITEMS, [], { year, status: null, shelf: "play" }, TZ);
      expect(rows.every((r) => r.item.title.kind === "game"), String(year)).toBe(true);
      expect(summarizePlayRows(rows), String(year)).toEqual(summarizePlay(titles, entries, year === null ? null : yearRange(year, TZ)));
    }
    const all = collectionRows(ITEMS, [], { year: null, status: null, shelf: "play" }, TZ);
    expect(summarizePlayRows(all)).toEqual({ minutes: (187 + 61) * 60, finished: 3 });
    // A row shows the player's hours, else the average (a game still being played too).
    expect(Object.fromEntries(all.map((r) => [r.item.id, r.lengthMin]))).toEqual({ e1: 187 * 60, e2: 61 * 60, e3: null, e4: 55 * 60 });
    // Games stay off the Watch tab, and add no watch time.
    const watch = collectionRows(ITEMS, [], { year: null, status: null, shelf: "watch" }, TZ);
    expect(watch.map((r) => r.item.id)).toEqual(["e5"]);
    expect(summarizeRows(watch)).toEqual({ minutes: 133, episodes: 0, finished: 1 });
  });

  it("the stats report's play equals the collection for each period, apart from watch time", () => {
    const now = Date.parse("2026-09-27T10:00:00Z");
    for (const period of ["week", "month", "year", "all"] as const) {
      const report = statsReport(titles, entries, [], { period, timeZone: TZ, weekStart: 1, now });
      const range = periodRange(period, { timeZone: TZ, weekStart: 1, now });
      expect(report.play, period).toEqual(summarizePlay(titles, entries, range));
      expect(report.split.play, period).toEqual(report.play);
      // Watch time stays watching only; titles finished count games too.
      expect(report.totals.minutes, period).toBe(summarizeCollection(titles, entries, [], range).minutes);
      expect(report.split.movie.finished, period).toBe(period === "week" ? 0 : 1);
    }
    const month = statsReport(titles, entries, [], { period: "month", timeZone: TZ, weekStart: 1, now });
    expect(month.play).toEqual({ minutes: (187 + 61) * 60, finished: 2 });
    expect(month.totals).toMatchObject({ minutes: 133, finished: 3 });
    // A game's finish lights up its day, it counts in taste, and it tops the period by time.
    expect(month.heatmap.days["2026-09-20"]).toBe(1);
    expect(month.genres).toEqual([{ key: "RPG", count: 2 }]);
    expect(month.topTitles[0]).toMatchObject({ name: "The Witcher 3", kind: "game", minutes: 187 * 60 });
    expect(month.card).toMatchObject({ minutes: 133, finished: 3, playMinutes: (187 + 61) * 60 });
  });

  it("recaps count play time on its own, and the smallest time gives way on a crowded card", () => {
    const recap = periodRecap("month", "2026-09-01", TZ, titles, entries, []);
    expect(recap).toMatchObject({ minutes: 133, finished: 3, titleCount: 3, playMinutes: (187 + 61) * 60 });
    expect(recap?.titles.map((t) => t.name)).toEqual(["The Witcher 3", "Tears of the Kingdom", "Parasite"]);
    expect(recapFigures(recap!)).toEqual([
      { key: "hours", value: 2 },
      { key: "playHours", value: 248 },
      { key: "finished", value: 3 },
    ]);
    // Watching, reading and playing all at once: the smallest time (watching here) gives way to titles finished.
    expect(recapFigures({ ...recap!, readMinutes: 600 }).map((f) => f.key)).toEqual(["readHours", "playHours", "finished"]);
    expect(recapFigures({ ...recap!, playMinutes: 45 }).map((f) => f.key)).toEqual(["hours", "playMinutes", "finished"]);
  });

  it("milestones count a game as a title finished, but not its hours", () => {
    const reached = reachedMilestones(titles, entries, []);
    expect(reached.filter((m) => m.metric === "hours")).toEqual([]);
  });
});
