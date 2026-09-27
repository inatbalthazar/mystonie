import { describe, expect, it } from "vitest";
import { addDays, lastWeekStart, recapCardData, recapFigures, recapRange, weeklyRecap, type RecapTitle } from "./recap";

const BKK = "Asia/Bangkok";
const poster = (p: string) => `https://image.tmdb.org/t/p/w342/${p}.jpg`;

const titles: RecapTitle[] = [
  { id: "st", kind: "series", name: "Stranger Things", runtimeMin: 50, episodeCount: 42, posterUrl: poster("st") },
  { id: "pa", kind: "movie", name: "Parasite", runtimeMin: 133, episodeCount: null, posterUrl: null },
  { id: "bb", kind: "series", name: "Bluey", runtimeMin: 7, episodeCount: 150, posterUrl: poster("bb") },
  { id: "old", kind: "movie", name: "Old", runtimeMin: 90, episodeCount: null, posterUrl: null },
];

describe("recap weeks", () => {
  it("covers Monday to Sunday in the user's time zone", () => {
    const range = recapRange("2026-09-21", BKK);
    expect(new Date(range.from).toISOString()).toBe("2026-09-20T17:00:00.000Z");
    expect(new Date(range.to).toISOString()).toBe("2026-09-27T17:00:00.000Z");
    expect(addDays("2026-09-21", 6)).toBe("2026-09-27");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
  });

  it("follows DST: a New York week across the November change is 7 days and 1 hour", () => {
    const range = recapRange("2026-10-26", "America/New_York");
    expect((range.to - range.from) / 3_600_000).toBe(7 * 24 + 1);
  });

  it("picks the last complete week, whatever the day", () => {
    // Monday 28 Sep 2026, 09:00 in Bangkok → the week of 21–27 Sep.
    expect(lastWeekStart(Date.parse("2026-09-28T02:00:00Z"), BKK)).toBe("2026-09-21");
    // Still Sunday 27 Sep in New York: the week before.
    expect(lastWeekStart(Date.parse("2026-09-28T02:00:00Z"), "America/New_York")).toBe("2026-09-14");
  });
});

describe("weeklyRecap", () => {
  const inWeek = "2026-09-24T12:00:00Z";
  const before = "2026-09-20T16:59:00Z"; // Sunday 23:59 in Bangkok, the week before
  const log = (id: string, titleId: string, watchedAt: string, extra = {}) => ({ id, titleId, runtimeMin: null, watchedAt, ...extra });

  it("returns null for an empty week", () => {
    expect(weeklyRecap("2026-09-21", BKK, titles, [], [log("l0", "st", before)])).toBeNull();
  });

  it("totals the week and ranks the collage by watched time", () => {
    const recap = weeklyRecap(
      "2026-09-21",
      BKK,
      titles,
      [
        { id: "e1", titleId: "pa", status: "finished", finishedAt: inWeek },
        { id: "e2", titleId: "old", status: "finished", finishedAt: before },
        { id: "e3", titleId: "st", status: "watching", finishedAt: null },
      ],
      [
        log("l1", "st", inWeek),
        log("l2", "st", inWeek, { runtimeMin: 60 }),
        log("l3", "st", before),
        log("l4", "st", inWeek, { deletedAt: inWeek }),
        log("l5", "bb", inWeek),
      ],
    );
    expect(recap).toEqual({
      from: "2026-09-21",
      to: "2026-09-27",
      minutes: 50 + 60 + 133 + 7,
      episodes: 3,
      finished: 1,
      titleCount: 3,
      titles: [
        { name: "Parasite", kind: "movie", posterUrl: null },
        { name: "Stranger Things", kind: "series", posterUrl: poster("st") },
        { name: "Bluey", kind: "series", posterUrl: poster("bb") },
      ],
    });
  });

  it("keeps at most four posters but counts every title", () => {
    const many: RecapTitle[] = Array.from({ length: 6 }, (_, i) => ({
      id: `m${i}`, kind: "movie", name: `Movie ${i}`, runtimeMin: 100 + i, episodeCount: null, posterUrl: null,
    }));
    const entries = many.map((t) => ({ id: `e${t.id}`, titleId: t.id, status: "finished" as const, finishedAt: inWeek }));
    const recap = weeklyRecap("2026-09-21", BKK, many, entries, [])!;
    expect(recap.titleCount).toBe(6);
    expect(recap.finished).toBe(6);
    expect(recap.titles.map((t) => t.name)).toEqual(["Movie 5", "Movie 4", "Movie 3", "Movie 2"]);
  });

  it("picks the big numbers, leaving out zeros and hidden ones", () => {
    const recap = { from: "2026-09-21", to: "2026-09-27", minutes: 583, episodes: 9, finished: 0, titleCount: 2, titles: [] };
    expect(recapFigures(recap)).toEqual([
      { key: "hours", value: 10 },
      { key: "episodes", value: 9 },
    ]);
    expect(recapFigures({ ...recap, minutes: 95, finished: 1 }, { episodes: true })).toEqual([
      { key: "minutes", value: 95 },
      { key: "finished", value: 1 },
    ]);
    expect(recapFigures(recap, { time: true, episodes: true })).toEqual([]);
  });

  it("makes card data from the top title", () => {
    const recap = weeklyRecap("2026-09-21", BKK, titles, [], [log("l1", "bb", inWeek)])!;
    expect(recapCardData(recap)).toMatchObject({ kind: "series", name: "Bluey", posterUrl: poster("bb"), finishedOn: "2026-09-27", recap });
  });
});
