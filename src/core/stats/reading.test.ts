import { describe, expect, it } from "vitest";
import type { CollectionItem } from "../collection/entries";
import { collectionRows, summarizeReadRows, summarizeRows, yearRange, type ReadLog } from "../collection/view";
import { periodRange } from "./period";
import { summarizeReading, titleRead, type StatsReadingLog } from "./reading";
import { statsReport, type ReportTitle } from "./report";
import { summarizeCollection } from "./summary";

// A manga caught up to chapter 1100 in one log, a book being read by page, a book finished without logs, and a
// movie (which must stay out of the reading numbers).
const ITEMS: CollectionItem[] = [
  {
    id: "e1",
    status: "watching",
    finishedAt: null,
    addedAt: "2026-08-01T00:00:00Z",
    title: { id: "op", source: "anilist", kind: "manga", externalId: "30013", name: "One Piece", year: 1997, posterUrl: null, chapterCount: null, volumeCount: null },
  },
  {
    id: "e2",
    status: "finished",
    finishedAt: "2026-09-20T12:00:00Z",
    addedAt: "2026-09-01T00:00:00Z",
    title: { id: "phm", source: "google_books", kind: "book", externalId: "3fzJEAAAQBAJ", name: "Project Hail Mary", year: 2021, posterUrl: null, pageCount: 496 },
  },
  {
    id: "e3",
    status: "finished",
    finishedAt: "2025-12-01T12:00:00Z",
    addedAt: "2025-11-01T00:00:00Z",
    title: { id: "dune-book", source: "google_books", kind: "book", externalId: "B00B00B00B00", name: "Dune", year: 1965, posterUrl: null, pageCount: 600 },
  },
  {
    id: "e4",
    status: "finished",
    finishedAt: "2026-09-10T12:00:00Z",
    addedAt: "2026-09-10T00:00:00Z",
    title: { id: "parasite", source: "tmdb", kind: "movie", externalId: "496243", name: "Parasite", year: 2019, posterUrl: null, runtimeMin: 133 },
  },
];

const READS: ReadLog[] = [
  { id: "r1", titleId: "op", unit: "chapter", position: 1100, readAt: "2026-09-02T12:00:00Z" },
  { id: "r2", titleId: "op", unit: "chapter", position: 1105, readAt: "2026-09-25T12:00:00Z" },
  { id: "r3", titleId: "phm", unit: "page", position: 120, readAt: "2026-09-05T12:00:00Z" },
  { id: "r4", titleId: "phm", unit: "page", position: 300, readAt: "2026-09-12T12:00:00Z" },
];

const TZ = "UTC";
const titles: ReportTitle[] = ITEMS.map(({ title }) => ({
  id: title.id!,
  kind: title.kind,
  name: title.name,
  posterUrl: null,
  genres: [],
  originalLanguage: null,
  runtimeMin: title.runtimeMin ?? null,
  episodeCount: null,
  pageCount: title.pageCount ?? null,
  chapterCount: title.chapterCount ?? null,
  volumeCount: title.volumeCount ?? null,
}));
const entries = ITEMS.map((i) => ({ id: i.id, titleId: i.title.id!, status: i.status, finishedAt: i.finishedAt }));
const reads: StatsReadingLog[] = READS;

describe("titleRead", () => {
  it("counts a manga's chapters from its checkpoints, with 5 minutes a chapter", () => {
    expect(titleRead(titles[0], entries[0], reads.filter((r) => r.titleId === "op"))).toEqual({
      minutes: 1105 * 5,
      pages: 0,
      chapters: 1105,
      volumes: 0,
      finished: 0,
    });
  });

  it("adds the rest of a book's pages on its finish date", () => {
    const phm = reads.filter((r) => r.titleId === "phm");
    expect(titleRead(titles[1], entries[1], phm)).toEqual({ minutes: Math.round(496 * 1.5), pages: 496, chapters: 0, volumes: 0, finished: 1 });
    // Only the logs of the 5th–12th, not the finish on the 20th.
    expect(titleRead(titles[1], entries[1], phm, { from: Date.parse("2026-09-01T00:00:00Z"), to: Date.parse("2026-09-15T00:00:00Z") })).toMatchObject({
      pages: 300,
      finished: 0,
    });
  });

  it("gives movies and series no reading", () => {
    expect(titleRead(titles[3], entries[3], [])).toEqual({ minutes: 0, pages: 0, chapters: 0, volumes: 0, finished: 0 });
  });
});

describe("reading totals agree everywhere", () => {
  it("the Read tab's header equals summarizeReading and the stats page, per year", () => {
    for (const year of [null, 2025, 2026]) {
      const rows = collectionRows(ITEMS, [], { year, status: null, shelf: "read" }, TZ, READS);
      const header = summarizeReadRows(rows);
      const range = year === null ? null : yearRange(year, TZ);
      const { booksFinished, mangaFinished, ...summary } = summarizeReading(titles, entries, reads, range);
      expect(header, String(year)).toEqual(summary);
      expect(booksFinished + mangaFinished).toBe(summary.finished);
    }
  });

  it("the stats report's reading equals the collection for each period, and splits reading from watching", () => {
    const now = Date.parse("2026-09-27T10:00:00Z");
    for (const period of ["week", "month", "year", "all"] as const) {
      const report = statsReport(titles, entries, [], { period, timeZone: TZ, weekStart: 1, now }, reads);
      const range = periodRange(period, { timeZone: TZ, weekStart: 1, now });
      expect(report.reading, period).toEqual(summarizeReading(titles, entries, reads, range));
      expect(report.split.reading.minutes, period).toBe(report.reading.minutes);
      expect(report.split.reading.finished, period).toBe(report.reading.finished);
      // Watch time stays watching only.
      expect(report.totals.minutes, period).toBe(summarizeCollection(titles, entries, [], range).minutes);
    }
    const month = statsReport(titles, entries, [], { period: "month", timeZone: TZ, weekStart: 1, now }, reads);
    expect(month.reading).toMatchObject({ chapters: 1105, pages: 496, finished: 1, booksFinished: 1 });
    expect(month.totals.minutes).toBe(133);
    // Reading days light up the heatmap: a log or a finish is one.
    expect(month.heatmap.days["2026-09-02"]).toBe(1);
    expect(month.heatmap.days["2026-09-20"]).toBe(1);
  });

  it("keeps the Watch tab free of books and manga", () => {
    const watch = collectionRows(ITEMS, [], { year: null, status: null, shelf: "watch" }, TZ, READS);
    expect(watch.map((r) => r.item.id)).toEqual(["e4"]);
    expect(summarizeRows(watch)).toEqual({ minutes: 133, episodes: 0, finished: 1 });
    const read = collectionRows(ITEMS, [], { year: null, status: null, shelf: "read" }, TZ, READS);
    expect(read.find((r) => r.item.id === "e1")).toMatchObject({ reached: { chapter: 1105, page: 0, volume: 0 }, lengthMin: 1105 * 5 });
  });
});
