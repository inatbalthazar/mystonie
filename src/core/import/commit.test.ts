import { describe, expect, it } from "vitest";
import { uuidv7 } from "../ids";
import {
  COMMIT_BATCH,
  COMMIT_MAX_LOGS,
  COMMIT_MAX_SERIES,
  commitBatches,
  importedFinishedAt,
  importRecap,
  MATCH_BATCH,
  parseCommitBody,
  parseMatchBody,
  planImport,
  undatedFinishedAt,
  type ImportedTitle,
  type ImportRow,
} from "./commit";

const NOW = Date.parse("2026-09-29T08:00:00Z");

describe("parseMatchBody", () => {
  it("reads every kind of query, tidying names", () => {
    const items = [
      { by: "film", name: "  Past   Lives ", year: 2023 },
      { by: "show", name: "Doctor Who", year: 2005, tvdbId: "78804" },
      { by: "book", name: "Dune", author: "Frank Herbert", isbn: "9780441172719" },
      { by: "mal", type: "manga", malId: 2, name: "Berserk" },
      { by: "id", kind: "book", externalId: "abcDEF123_-x" },
    ];
    expect(parseMatchBody({ items })).toEqual([{ by: "film", name: "Past Lives", year: 2023 }, ...items.slice(1)]);
  });

  it("rejects anything off", () => {
    const one = (q: unknown) => parseMatchBody({ items: [q] });
    expect(parseMatchBody(null)).toBeNull();
    expect(parseMatchBody({ items: [] })).toBeNull();
    expect(parseMatchBody({ items: Array.from({ length: MATCH_BATCH + 1 }, () => ({ by: "film", name: "A", year: 2000 })) })).toBeNull();
    expect(one({ by: "film", name: " ", year: 2000 })).toBeNull();
    expect(one({ by: "film", name: "x".repeat(301), year: 2000 })).toBeNull();
    expect(one({ by: "film", name: "A", year: "2000" })).toBeNull();
    expect(one({ by: "film", name: "A" })).toBeNull();
    expect(one({ by: "show", name: "A", year: null, tvdbId: "x1" })).toBeNull();
    expect(one({ by: "book", name: "A", author: null, isbn: "123" })).toBeNull();
    expect(one({ by: "mal", type: "novel", malId: 1, name: "A" })).toBeNull();
    expect(one({ by: "mal", type: "anime", malId: 0, name: "A" })).toBeNull();
    expect(one({ by: "id", kind: "movie", externalId: "tt123" })).toBeNull();
    expect(one({ by: "guess", name: "A" })).toBeNull();
  });
});

const row = (over: Partial<ImportRow> = {}): ImportRow => ({
  id: uuidv7(),
  kind: "movie",
  externalId: "496243",
  status: "finished",
  watchedOn: "2024-09-08",
  finishedAt: null,
  undated: false,
  rating: 5,
  review: null,
  episodes: [],
  reading: [],
  ...over,
});

describe("parseCommitBody", () => {
  it("reads finished, watching and wanted rows of every kind, with their logs", () => {
    const rows = [
      row(),
      row({ externalId: "1", status: "want", watchedOn: null, rating: null }),
      row({ kind: "series", externalId: "2", status: "watching", watchedOn: null, episodes: [{ season: 1, episode: 1, watchedAt: "2024-01-01T20:00:00.000Z" }] }),
      row({ kind: "manga", externalId: "3", status: "finished", watchedOn: null, undated: true, rating: 4.5 }),
      row({ kind: "book", externalId: "abcDEF123_-x", watchedOn: null, finishedAt: "2025-05-05T10:00:00.000Z", review: "Loved it" }),
      row({ kind: "manga", externalId: "4", status: "watching", watchedOn: null, reading: [{ unit: "chapter", position: 112, readAt: "2025-01-02T12:00:00.000Z" }] }),
    ];
    expect(parseCommitBody({ rows }, NOW)).toEqual({ rows, done: false });
    expect(parseCommitBody({ rows, done: true }, NOW)).toEqual({ rows, done: true });
  });

  it("allows an empty last request", () => {
    expect(parseCommitBody({ rows: [], done: true }, NOW)).toEqual({ rows: [], done: true });
    expect(parseCommitBody({ rows: [] }, NOW)).toBeNull();
  });

  it("drops logs from the future and dedupes episodes", () => {
    const at = "2024-01-01T20:00:00.000Z";
    const parsed = parseCommitBody(
      {
        rows: [
          row({
            kind: "series",
            status: "watching",
            watchedOn: null,
            episodes: [
              { season: 1, episode: 1, watchedAt: at },
              { season: 1, episode: 1, watchedAt: at },
              { season: 1, episode: 2, watchedAt: "2030-01-01T00:00:00.000Z" },
            ],
          }),
        ],
      },
      NOW,
    );
    expect(parsed?.rows[0]!.episodes).toEqual([{ season: 1, episode: 1, watchedAt: at }]);
  });

  it("keeps a game's hours played, and only a game's (S3 games)", () => {
    const game = row({ kind: "game", externalId: "3328", hoursPlayed: 187 });
    expect(parseCommitBody({ rows: [game] }, NOW)?.rows[0]).toMatchObject({ kind: "game", hoursPlayed: 187 });
    for (const bad of [row({ hoursPlayed: 3 }), row({ kind: "game", externalId: "3328", hoursPlayed: 0 }), row({ kind: "game", externalId: "3328", hoursPlayed: 1.5 })]) {
      expect(parseCommitBody({ rows: [bad] }, NOW), JSON.stringify(bad)).toBeNull();
    }
  });

  it("rejects bad rows", () => {
    const bad = (r: Record<string, unknown>) => parseCommitBody({ rows: [{ ...row(), ...r }] }, NOW);
    expect(bad({ id: "0190a0e2-0000-4000-8000-000000000000" })).toBeNull();
    expect(bad({ externalId: "tt123" })).toBeNull();
    expect(bad({ kind: "podcast" })).toBeNull();
    expect(bad({ watchedOn: null })).toBeNull(); // finished says when
    expect(bad({ watchedOn: "8/9/2024" })).toBeNull();
    expect(bad({ status: "want" })).toBeNull(); // a wanted title has no date
    expect(bad({ status: "watching", watchedOn: null, undated: true })).toBeNull();
    expect(bad({ rating: 4.2 })).toBeNull();
    expect(bad({ rating: 0 })).toBeNull();
    expect(bad({ review: "x".repeat(281) })).toBeNull();
    expect(bad({ episodes: [{ season: 1, episode: 1, watchedAt: "2024-01-01T00:00:00Z" }] })).toBeNull(); // not a series
    expect(bad({ kind: "book", externalId: "abcDEF123_-x", reading: [{ unit: "chapter", position: 1, readAt: "2024-01-01T00:00:00Z" }] })).toBeNull();
    expect(bad({ kind: "series", episodes: [{ season: 0, episode: 1, watchedAt: "2024-01-01T00:00:00Z" }] })).toBeNull();
  });

  it("rejects a title twice, too many rows, series or logs, and a bad done", () => {
    expect(parseCommitBody({ rows: [row(), row()] }, NOW)).toBeNull();
    const same = row();
    expect(parseCommitBody({ rows: [same, { ...same, externalId: "1" }] }, NOW)).toBeNull();
    expect(parseCommitBody({ rows: Array.from({ length: COMMIT_BATCH + 1 }, (_, i) => row({ externalId: String(i + 1) })) }, NOW)).toBeNull();
    const series = (i: number, n = 1) =>
      row({
        kind: "series",
        externalId: String(i + 1),
        status: "watching",
        watchedOn: null,
        episodes: Array.from({ length: n }, (_, e) => ({ season: 1, episode: e + 1, watchedAt: "2024-01-01T00:00:00.000Z" })),
      });
    expect(parseCommitBody({ rows: Array.from({ length: COMMIT_MAX_SERIES + 1 }, (_, i) => series(i)) }, NOW)).toBeNull();
    expect(parseCommitBody({ rows: [series(1, COMMIT_MAX_LOGS), series(2, 1)] }, NOW)).toBeNull();
    expect(parseCommitBody({ rows: [row()], done: "yes" }, NOW)).toBeNull();
    expect(parseCommitBody({ rows: "all" }, NOW)).toBeNull();
  });
});

describe("commitBatches", () => {
  const logs = (n: number) => Array.from({ length: n }, (_, e) => ({ season: 1, episode: e + 1, watchedAt: "2024-01-01T00:00:00.000Z" }));

  it("cuts at 25 rows, 5 series and 3,000 logs, keeping the order", () => {
    const films = Array.from({ length: 60 }, () => ({ episodes: [], reading: [] }));
    expect(commitBatches(films).map((b) => b.length)).toEqual([25, 25, 10]);
    const shows = Array.from({ length: 12 }, () => ({ episodes: logs(10), reading: [] }));
    expect(commitBatches(shows).map((b) => b.length)).toEqual([5, 5, 2]);
    const long = [{ episodes: logs(2000), reading: [] }, { episodes: logs(1500), reading: [] }, { episodes: [], reading: [] }];
    expect(commitBatches(long).map((b) => b.length)).toEqual([1, 2]);
    expect(commitBatches([])).toEqual([]);
  });
});

describe("importedFinishedAt", () => {
  it("is noon that day in the user's time zone", () => {
    expect(importedFinishedAt("2024-09-08", "Asia/Bangkok", NOW)).toBe("2024-09-08T05:00:00.000Z");
  });

  it("is now for today, or a day the user's calendar hasn't reached", () => {
    expect(importedFinishedAt("2026-09-29", "Asia/Bangkok", NOW)).toBe("2026-09-29T08:00:00.000Z");
    expect(importedFinishedAt("2026-09-30", "America/Los_Angeles", NOW)).toBe("2026-09-29T08:00:00.000Z");
  });

  it("is null for something that isn't a date", () => {
    expect(importedFinishedAt("soon", "UTC", NOW)).toBeNull();
  });
});

describe("undatedFinishedAt", () => {
  it("is 1 January of the title's year, never ahead of now", () => {
    expect(undatedFinishedAt(1998, NOW)).toBe("1998-01-01T12:00:00.000Z");
    expect(undatedFinishedAt(2027, NOW)).toBe("2026-09-29T08:00:00.000Z");
    expect(undatedFinishedAt(null, NOW)).toBe("2026-09-29T08:00:00.000Z");
  });
});

describe("planImport", () => {
  const r = row({ rating: 4.5 });
  const had = (status: ImportRow["status"], rating: number | null, review: string | null = null) => ({ id: uuidv7(), status, rating, review });

  it("adds a title that isn't there", () => {
    expect(planImport(r, undefined)).toEqual({ action: "insert" });
  });

  it("knows a retried row it already saved", () => {
    expect(planImport(r, { id: r.id, status: "finished", rating: 4.5, review: null })).toEqual({ action: "keep", retried: true });
  });

  it("moves the status forward and fills a missing rating or review", () => {
    expect(planImport(r, had("want", null))).toEqual({ action: "update", status: "finished", rating: true, review: false, hours: false });
    expect(planImport(r, had("watching", 3))).toEqual({ action: "update", status: "finished", rating: false, review: false, hours: false });
    expect(planImport(r, had("finished", null))).toEqual({ action: "update", status: null, rating: true, review: false, hours: false });
    const watching = row({ status: "watching", watchedOn: null, rating: null });
    expect(planImport(watching, had("want", null))).toEqual({ action: "update", status: "watching", rating: false, review: false, hours: false });
    expect(planImport(row({ review: "Great" }), had("finished", 5))).toEqual({ action: "update", status: null, rating: false, review: true, hours: false });
  });

  it("fills a game's missing hours played, and keeps hours already there (S3 games)", () => {
    const game = row({ kind: "game", externalId: "3328", hoursPlayed: 187 });
    expect(planImport(game, { ...had("finished", 4.5), hoursPlayed: null })).toEqual({ action: "update", status: null, rating: false, review: false, hours: true });
    expect(planImport(game, { ...had("finished", 4.5), hoursPlayed: 90 })).toEqual({ action: "keep", retried: false });
  });

  it("never moves back, and keeps what the user did in Mystonie otherwise (re-importing adds nothing)", () => {
    expect(planImport(r, had("finished", 2))).toEqual({ action: "keep", retried: false });
    const want = row({ status: "want", watchedOn: null, rating: null });
    expect(planImport(want, had("watching", null))).toEqual({ action: "keep", retried: false });
    expect(planImport(want, had("finished", null))).toEqual({ action: "keep", retried: false });
    expect(planImport(row({ status: "watching", watchedOn: null, rating: null }), had("finished", null))).toEqual({ action: "keep", retried: false });
    expect(planImport(row({ review: "New" }), had("finished", 5, "Mine"))).toEqual({ action: "keep", retried: false });
  });
});

describe("importRecap", () => {
  const title = (name: string, on: string, rating: number | null, minutes: number, over: Partial<ImportedTitle> = {}): ImportedTitle => ({
    name,
    kind: "movie",
    posterUrl: `https://image.tmdb.org/t/p/w342/${name}.jpg`,
    minutes,
    episodes: 0,
    finished: true,
    rating,
    from: on,
    to: on,
    ...over,
  });

  it("sums the films up, with the best rated (then latest) in the collage", () => {
    const recap = importRecap([
      title("A", "2014-01-02", 4, 100),
      title("B", "2020-05-05", 5, 120),
      title("C", "2018-03-03", null, 0),
      title("D", "2026-09-01", 4, 90),
      title("E", "2019-07-07", 5, 110),
    ]);
    expect(recap).toEqual({
      period: "all",
      imported: true,
      from: "2014-01-02",
      to: "2026-09-01",
      minutes: 420,
      episodes: 0,
      finished: 5,
      titleCount: 5,
      titles: ["B", "E", "D", "A"].map((name) => ({ name, kind: "movie", posterUrl: `https://image.tmdb.org/t/p/w342/${name}.jpg` })),
    });
  });

  it("counts shows being watched by their episodes, and names the unit when it isn't films", () => {
    const recap = importRecap([
      title("Show", "2019-01-01", null, 900, { kind: "series", finished: false, episodes: 20, to: "2021-06-01" }),
      title("Done", "2022-02-02", 4, 400, { kind: "series", episodes: 8 }),
    ]);
    expect(recap).toMatchObject({ importedUnit: "series", from: "2019-01-01", to: "2022-02-02", minutes: 1300, episodes: 28, finished: 1, titleCount: 2 });
    expect(importRecap([title("A", "2020-01-01", null, 0, { kind: "book" }), title("B", "2020-01-01", null, 0)])).toMatchObject({ importedUnit: "title" });
  });

  it("is null when the import brought nothing", () => {
    expect(importRecap([])).toBeNull();
  });
});
