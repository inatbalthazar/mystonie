import { describe, expect, it } from "vitest";
import { parseCardSave } from "../cards/saved";
import { templatesFor } from "../cards/templates";
import { recapCardData } from "./recap";
import { statsReport, type ReportTitle } from "./report";
import type { StatsEntry, StatsEpisodeLog } from "./summary";
import { isReviewYear, reviewSeasonYear, yearInReview } from "./year-review";

const title = (t: Partial<ReportTitle> & Pick<ReportTitle, "id" | "kind" | "name">): ReportTitle => ({
  posterUrl: null,
  genres: [],
  originalLanguage: null,
  runtimeMin: null,
  episodeCount: null,
  ...t,
});

const BKK = "Asia/Bangkok";
const titles: ReportTitle[] = [
  title({ id: "pa", kind: "movie", name: "Parasite", runtimeMin: 133, genres: ["Thriller", "Drama"], originalLanguage: "ko" }),
  title({ id: "du", kind: "movie", name: "Dune", runtimeMin: 155, genres: ["Science Fiction"] }),
  title({ id: "st", kind: "series", name: "Stranger Things", runtimeMin: 50, episodeCount: 42, genres: ["Drama", "Mystery"] }),
  title({ id: "hm", kind: "book", name: "Project Hail Mary", pageCount: 496 }),
];
const entries: StatsEntry[] = [
  { id: "e1", titleId: "pa", status: "finished", finishedAt: "2025-12-31T18:00:00Z" }, // Jan 1, 01:00 in Bangkok
  { id: "e2", titleId: "du", status: "finished", finishedAt: "2026-06-10T12:00:00Z" },
  { id: "e3", titleId: "hm", status: "finished", finishedAt: "2026-11-02T12:00:00Z" },
  { id: "e4", titleId: "st", status: "watching", finishedAt: null },
];
// Three days in a row of Stranger Things in March, one more in July.
const logs: StatsEpisodeLog[] = [
  { id: "l1", titleId: "st", runtimeMin: null, watchedAt: "2026-03-01T12:00:00Z" },
  { id: "l2", titleId: "st", runtimeMin: null, watchedAt: "2026-03-02T12:00:00Z" },
  { id: "l3", titleId: "st", runtimeMin: null, watchedAt: "2026-03-03T12:00:00Z" },
  { id: "l4", titleId: "st", runtimeMin: null, watchedAt: "2026-07-01T12:00:00Z" },
];
const options = { year: 2026, timeZone: BKK, weekStart: 1 };

describe("yearInReview", () => {
  it("is the stats page's year, with the year's bookends and highlights", () => {
    const now = Date.parse("2027-01-15T00:00:00Z");
    const review = yearInReview(titles, entries, logs, [], { ...options, now });
    expect(review.complete).toBe(true);
    // Same numbers as the stats page's "This year" seen on the year's last day.
    const lastDay = Date.parse("2026-12-31T12:00:00Z");
    const stats = statsReport(titles, entries, logs, { period: "year", timeZone: BKK, weekStart: 1, now: lastDay });
    expect(review.report.totals).toEqual(stats.totals);
    expect(review.report.totals).toMatchObject({ minutes: 133 + 155 + 4 * 50, episodes: 4, finished: 3 });
    expect(review.report.reading.pages).toBe(496);
    expect(review.report.activeDays).toBe(7);
    expect(review.report.topTitles.map((t) => t.name)).toEqual(["Project Hail Mary", "Stranger Things", "Dune", "Parasite"]);

    expect(review.firstFinish).toEqual({ name: "Parasite", kind: "movie", posterUrl: null, on: "2026-01-01" });
    expect(review.lastFinish).toMatchObject({ name: "Project Hail Mary", on: "2026-11-02" });
    expect(review.card).toMatchObject({
      period: "year",
      from: "2026-01-01",
      to: "2026-12-31",
      minutes: 488,
      finished: 3,
      readMinutes: 744,
      highlights: { genre: "Drama", month: "2026-06", streak: 3 },
    });
  });

  it("counts a running year up to now, ending its card today", () => {
    const now = Date.parse("2026-07-01T13:00:00Z");
    const soFar = entries.filter((e) => e.id !== "e3"); // the November finish hasn't happened yet
    const review = yearInReview(titles, soFar, logs, [], { ...options, now });
    expect(review.complete).toBe(false);
    expect(review.report.totals.finished).toBe(2);
    expect(review.card).toMatchObject({ from: "2026-01-01", to: "2026-07-01" });
    expect(review.lastFinish?.name).toBe("Dune");
  });

  it("is empty for a year with nothing in it", () => {
    const review = yearInReview(titles, entries, logs, [], { ...options, year: 2024, now: Date.parse("2026-12-05T00:00:00Z") });
    expect(review.card).toBeNull();
    expect(review.firstFinish).toBeNull();
    expect(review.milestones).toEqual([]);
  });

  it("lists the year's milestones", () => {
    const many = Array.from({ length: 10 }, (_, i) => title({ id: `m${i}`, kind: "movie", name: `M${i}`, runtimeMin: 100 }));
    const done = many.map((m, i) => ({ id: `x${i}`, titleId: m.id, status: "finished" as const, finishedAt: `2026-0${(i % 9) + 1}-15T12:00:00Z` }));
    const review = yearInReview(many, done, [], [], { ...options, now: Date.parse("2026-12-05T00:00:00Z") });
    expect(review.milestones).toEqual([{ metric: "titles", value: 10, on: "2026-09-15", title: { name: "M8", kind: "movie", posterUrl: null } }]);
  });

  it("saves as a year_review card, drawn by the yearbook", () => {
    const review = yearInReview(titles, entries, logs, [], { ...options, now: Date.parse("2027-01-15T00:00:00Z") });
    const card = { id: "01926000-0000-7000-8000-000000000001", kind: "year_review", templateId: "yearbook", size: "story", data: recapCardData(review.card!) };
    expect(parseCardSave(card)).toMatchObject({ kind: "year_review", data: { recap: { highlights: { streak: 3 } } } });
    expect(templatesFor("year_review", "book")).toEqual(["boldStats", "collage", "yearbook"]);
    for (const bad of [
      { ...card, kind: "stats" }, // highlights are a Year in Review's
      { ...card, recapId: "01926000-0000-7000-8000-000000000002" },
      { ...card, data: recapCardData({ ...review.card!, period: "month" }) },
      { ...card, data: recapCardData({ ...review.card!, highlights: { month: "2026-13" } }) },
    ]) {
      expect(parseCardSave(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("when Year in Review shows", () => {
  it("allows 2000 up to the current local year", () => {
    const now = Date.parse("2026-12-31T18:00:00Z"); // Jan 1 2027 in Bangkok, Dec 31 in New York
    expect(isReviewYear(2027, now, BKK)).toBe(true);
    expect(isReviewYear(2027, now, "America/New_York")).toBe(false);
    expect(isReviewYear(1999, now, BKK)).toBe(false);
    expect(isReviewYear(2026.5, now, BKK)).toBe(false);
  });

  it("points Home at this year in December and last year in January", () => {
    expect(reviewSeasonYear(Date.parse("2026-12-01T00:00:00Z"), BKK)).toBe(2026);
    expect(reviewSeasonYear(Date.parse("2027-01-20T00:00:00Z"), BKK)).toBe(2026);
    expect(reviewSeasonYear(Date.parse("2026-11-30T12:00:00Z"), "UTC")).toBeNull();
  });
});
