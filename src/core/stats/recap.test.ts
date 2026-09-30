import { describe, expect, it } from "vitest";
import { parseCardSave } from "../cards/saved";
import { addDays, lastMonthStart, lastWeekStart, periodRecap, recapCardData, recapFigures, recapRange, weeklyRecap, type RecapTitle } from "./recap";
import { summarizeReading } from "./reading";

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

describe("monthly recaps (S2 milestones & recaps)", () => {
  const manga: RecapTitle = { id: "op", kind: "manga", name: "One Piece", runtimeMin: null, episodeCount: null, chapterCount: null, posterUrl: null };
  const book: RecapTitle = { id: "hm", kind: "book", name: "Project Hail Mary", runtimeMin: null, episodeCount: null, pageCount: 496, posterUrl: null };
  const all = [...titles, manga, book];
  const read = (id: string, titleId: string, unit: "page" | "chapter", position: number, readAt: string) => ({ id, titleId, unit, position, readAt });

  it("covers a calendar month in the user's time zone, and the month before on the 1st", () => {
    const range = recapRange("2026-09-01", BKK, "month");
    expect(new Date(range.from).toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(new Date(range.to).toISOString()).toBe("2026-09-30T17:00:00.000Z");
    // 1 Oct 09:00 in Bangkok is still 30 Sep in New York.
    expect(lastMonthStart(Date.parse("2026-10-01T02:00:00Z"), BKK)).toBe("2026-09-01");
    expect(lastMonthStart(Date.parse("2026-10-01T02:00:00Z"), "America/New_York")).toBe("2026-08-01");
    expect(lastMonthStart(Date.parse("2027-01-01T02:00:00Z"), BKK)).toBe("2026-12-01");
  });

  it("adds reading: time, activity and finishes, with a log counting only what it adds", () => {
    const logs = [
      read("r0", "op", "chapter", 1000, "2026-08-15T10:00:00Z"), // before the month
      read("r1", "op", "chapter", 1100, "2026-09-10T10:00:00Z"), // +100 chapters in September
    ];
    const entries = [
      { id: "e1", titleId: "hm", status: "finished" as const, finishedAt: "2026-09-20T10:00:00Z" }, // all 496 pages
      { id: "e2", titleId: "pa", status: "finished" as const, finishedAt: "2026-09-05T10:00:00Z" },
    ];
    const recap = periodRecap("month", "2026-09-01", BKK, all, entries, [], logs)!;
    // 100 chapters × 5 min + 496 pages × 1.5 min = 500 + 744.
    expect(recap).toMatchObject({ period: "month", from: "2026-09-01", to: "2026-09-30", minutes: 133, episodes: 0, finished: 2, titleCount: 3 });
    expect(recap.readMinutes).toBe(1244);
    expect(recap.titles.map((t) => t.name)).toEqual(["Project Hail Mary", "One Piece", "Parasite"]);
    // The same reading time as the Read tab's header for September.
    expect(recap.readMinutes).toBe(summarizeReading(all, entries, logs, recapRange("2026-09-01", BKK, "month")).minutes);
    // A reading-only week is still a recap; a weekly recap has no period.
    const week = weeklyRecap("2026-09-07", BKK, all, [], [], logs)!;
    expect(week.period).toBeUndefined();
    expect(week).toMatchObject({ minutes: 0, readMinutes: 500, titleCount: 1 });
  });

  it("shows reading time in the figures, keeping three at most", () => {
    const recap = { from: "2026-09-01", to: "2026-09-30", minutes: 600, episodes: 12, finished: 2, titleCount: 4, titles: [], readMinutes: 90 };
    expect(recapFigures(recap)).toEqual([
      { key: "hours", value: 10 },
      { key: "readMinutes", value: 90 },
      { key: "finished", value: 2 },
    ]);
    expect(recapFigures({ ...recap, readMinutes: 300 }, { time: true })).toEqual([
      { key: "episodes", value: 12 },
      { key: "finished", value: 2 },
    ]);
    expect(recapFigures({ ...recap, readMinutes: 300, minutes: 0 })[0]).toEqual({ key: "readHours", value: 5 });
  });

  it("saves as a monthly_recap card linked to its recap", () => {
    const recap = periodRecap("month", "2026-09-01", BKK, all, [{ id: "e2", titleId: "pa", status: "finished", finishedAt: "2026-09-05T10:00:00Z" }], [])!;
    const card = {
      id: "01926000-0000-7000-8000-000000000001",
      kind: "monthly_recap",
      templateId: "collage",
      size: "story",
      recapId: "01926000-0000-7000-8000-000000000002",
      data: recapCardData(recap),
    };
    expect(parseCardSave(card)).toMatchObject({ kind: "monthly_recap", recapId: card.recapId, data: { recap: { period: "month" } } });
    expect(parseCardSave({ ...card, kind: "sticker", templateId: "sticker" })).not.toBeNull();
    expect(parseCardSave({ ...card, kind: "weekly_recap" })).toBeNull(); // a week has no period
    expect(parseCardSave({ ...card, data: recapCardData({ ...recap, period: "year" }) })).toBeNull();
    expect(parseCardSave({ ...card, templateId: "stone" })).toBeNull();
  });
});
