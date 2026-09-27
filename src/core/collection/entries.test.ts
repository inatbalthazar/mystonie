import { describe, expect, it } from "vitest";
import { finishedAtForDate, parseEntryPatch, parseNewEntry, sortCollection, statusColumns, titleKey } from "./entries";

const NOW = Date.parse("2026-09-27T20:00:00Z"); // 28 Sep 03:00 in Bangkok
const ID = "01926000-0000-7000-8000-000000000001";

describe("parseNewEntry", () => {
  const body = { id: ID, title: { source: "tmdb", kind: "movie", externalId: "496243" }, status: "finished" };

  it("defaults finished_at to now for a finish, and clears it otherwise", () => {
    expect(parseNewEntry(body, NOW)).toEqual({
      id: ID,
      title: { source: "tmdb", kind: "movie", externalId: "496243" },
      status: "finished",
      finishedAt: "2026-09-27T20:00:00.000Z",
    });
    expect(parseNewEntry({ ...body, status: "want", finishedAt: "2026-09-01T00:00:00Z" }, NOW)?.finishedAt).toBeNull();
  });

  it("keeps a picked finish date, normalized to UTC", () => {
    expect(parseNewEntry({ ...body, finishedAt: "2026-09-01T12:00:00+07:00" }, NOW)?.finishedAt).toBe(
      "2026-09-01T05:00:00.000Z",
    );
  });

  it("rejects bad input", () => {
    const bad = [
      null,
      [],
      { ...body, id: "b5a8c1a4-8c2e-4b0e-9d6f-2f3a1c0e9b11" },
      { ...body, status: "dropped" },
      { ...body, title: { ...body.title, source: "imdb" } },
      { ...body, title: { ...body.title, kind: "book" } },
      { ...body, title: { ...body.title, externalId: "1; drop table" } },
      { ...body, finishedAt: "yesterday" },
      { ...body, finishedAt: "2026-09-30T00:00:00Z" }, // days ahead
      { ...body, finishedAt: "1850-01-01T00:00:00Z" },
    ];
    for (const b of bad) expect(parseNewEntry(b, NOW), JSON.stringify(b)).toBeNull();
  });
});

describe("parseEntryPatch", () => {
  it("accepts a status change, a finish date or a removal", () => {
    expect(parseEntryPatch({ status: "watching", finishedAt: "2026-09-01T00:00:00Z" }, NOW)).toEqual({
      status: "watching",
      finishedAt: null,
    });
    expect(parseEntryPatch({ status: "finished", finishedAt: "2026-09-01T00:00:00Z" }, NOW)).toEqual({
      status: "finished",
      finishedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(parseEntryPatch({ deleted: true }, NOW)).toEqual({ deleted: true });
  });

  it("accepts a rating and a review, and clears them with null", () => {
    expect(parseEntryPatch({ rating: 4.5, review: "  Loved   it \n" }, NOW)).toEqual({ notes: { rating: 4.5, review: "Loved it" } });
    expect(parseEntryPatch({ rating: null, review: " " }, NOW)).toEqual({ notes: { rating: null, review: null } });
    expect(parseEntryPatch({ rating: 4.25, review: null }, NOW)).toBeNull();
    expect(parseEntryPatch({ rating: 0, review: null }, NOW)).toBeNull();
    expect(parseEntryPatch({ rating: 3 }, NOW)).toBeNull(); // both, so nothing is cleared by accident
    expect(parseEntryPatch({ rating: null, review: "ก".repeat(281) }, NOW)).toBeNull();
  });

  it("rejects bad input", () => {
    expect(parseEntryPatch({}, NOW)).toBeNull();
    expect(parseEntryPatch({ deleted: "yes" }, NOW)).toBeNull();
    expect(parseEntryPatch({ status: "finished", finishedAt: "not a date" }, NOW)).toBeNull();
  });
});

describe("statusColumns", () => {
  it("keeps finished_at only for finished", () => {
    expect(statusColumns("finished", "2026-01-01T00:00:00.000Z", NOW).finishedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(statusColumns("finished", null, NOW).finishedAt).toBe("2026-09-27T20:00:00.000Z");
    expect(statusColumns("want", "2026-01-01T00:00:00.000Z", NOW).finishedAt).toBeNull();
  });
});

describe("finishedAtForDate", () => {
  it("is now for today in the user's time zone, noon local time for an earlier day", () => {
    expect(finishedAtForDate("2026-09-28", "Asia/Bangkok", NOW)).toBe("2026-09-27T20:00:00.000Z");
    expect(finishedAtForDate("2026-09-27", "Asia/Bangkok", NOW)).toBe("2026-09-27T05:00:00.000Z");
    expect(finishedAtForDate("2026-09-27", "UTC", NOW)).toBe("2026-09-27T20:00:00.000Z");
  });

  it("rejects future, impossible and malformed dates", () => {
    expect(finishedAtForDate("2026-09-28", "UTC", NOW)).toBeNull();
    expect(finishedAtForDate("2026-02-31", "UTC", NOW)).toBeNull();
    expect(finishedAtForDate("27/09/2026", "UTC", NOW)).toBeNull();
    expect(finishedAtForDate("1899-12-31", "UTC", NOW)).toBeNull();
  });
});

describe("sortCollection", () => {
  it("puts the latest finish or addition first", () => {
    const items = [
      { id: "a", finishedAt: "2026-09-01T00:00:00Z", addedAt: "2026-09-01T00:00:00Z" },
      { id: "b", finishedAt: null, addedAt: "2026-09-10T00:00:00Z" },
      { id: "c", finishedAt: "2026-09-20T00:00:00Z", addedAt: "2026-08-01T00:00:00Z" },
      { id: "d", finishedAt: "2026-09-20T00:00:00Z", addedAt: "2026-08-01T00:00:00Z" },
    ];
    expect(sortCollection(items).map((i) => i.id)).toEqual(["d", "c", "b", "a"]);
  });
});

describe("titleKey", () => {
  it("separates movies and series with the same TMDB id", () => {
    expect(titleKey({ source: "tmdb", kind: "movie", externalId: "1" })).not.toBe(
      titleKey({ source: "tmdb", kind: "series", externalId: "1" }),
    );
  });
});
