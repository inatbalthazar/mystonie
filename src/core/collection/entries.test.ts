import { describe, expect, it } from "vitest";
import { actionTime, finishedAtFor, finishedAtForDate, isPastFinish, parseEntryPatch, parseNewEntry, sortCollection, statusColumns, titleKey } from "./entries";

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
      editedAt: "2026-09-27T20:00:00.000Z",
    });
    expect(parseNewEntry({ ...body, status: "want", finishedAt: "2026-09-01T00:00:00Z" }, NOW)?.finishedAt).toBeNull();
  });

  it("keeps when a change made offline was made, and dates a finish without a date then (ADR 0042)", () => {
    expect(parseNewEntry({ ...body, editedAt: "2026-09-25T08:00:00Z" }, NOW)).toMatchObject({
      finishedAt: "2026-09-25T08:00:00.000Z",
      editedAt: "2026-09-25T08:00:00.000Z",
    });
    expect(parseNewEntry({ ...body, editedAt: "2026-09-25T08:00:00Z", finishedAt: "2026-09-20T12:00:00Z" }, NOW)).toMatchObject({
      finishedAt: "2026-09-20T12:00:00.000Z",
      editedAt: "2026-09-25T08:00:00.000Z",
    });
    // A device clock a little ahead is clamped to the server's now; a bad time is refused.
    expect(parseNewEntry({ ...body, editedAt: "2026-09-27T22:00:00Z" }, NOW)?.editedAt).toBe("2026-09-27T20:00:00.000Z");
    expect(parseNewEntry({ ...body, editedAt: "soon" }, NOW)).toBeNull();
  });

  it("keeps a picked finish date, normalized to UTC", () => {
    expect(parseNewEntry({ ...body, finishedAt: "2026-09-01T12:00:00+07:00" }, NOW)?.finishedAt).toBe(
      "2026-09-01T05:00:00.000Z",
    );
  });

  it("accepts books from Google Books and manga from AniList (S2 books & manga)", () => {
    const book = { ...body, title: { source: "google_books", kind: "book", externalId: "3fzJEAAAQBAJ" } };
    const manga = { ...body, status: "watching", title: { source: "anilist", kind: "manga", externalId: "30013" } };
    expect(parseNewEntry(book, NOW)?.title).toEqual(book.title);
    expect(parseNewEntry(manga, NOW)).toMatchObject({ title: manga.title, status: "watching", finishedAt: null });
    // Each kind only from its own catalog, with that catalog's ids.
    expect(parseNewEntry({ ...body, title: { source: "anilist", kind: "book", externalId: "30013" } }, NOW)).toBeNull();
    expect(parseNewEntry({ ...body, title: { source: "google_books", kind: "book", externalId: "30013" } }, NOW)).toBeNull();
  });

  it("accepts games from RAWG (S3 games)", () => {
    const game = { ...body, status: "want", title: { source: "rawg", kind: "game", externalId: "3328" } };
    expect(parseNewEntry(game, NOW)).toMatchObject({ title: game.title, status: "want", finishedAt: null });
    expect(parseNewEntry({ ...body, title: { source: "tmdb", kind: "game", externalId: "3328" } }, NOW)).toBeNull();
    expect(parseNewEntry({ ...body, title: { source: "rawg", kind: "game", externalId: "the-witcher-3" } }, NOW)).toBeNull();
    expect(parseNewEntry({ ...body, title: { source: "rawg", kind: "movie", externalId: "3328" } }, NOW)).toBeNull();
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
    const editedAt = "2026-09-27T20:00:00.000Z";
    expect(parseEntryPatch({ status: "watching", finishedAt: "2026-09-01T00:00:00Z" }, NOW)).toEqual({
      status: "watching",
      finishedAt: null,
      editedAt,
    });
    expect(parseEntryPatch({ status: "finished", finishedAt: "2026-09-01T00:00:00Z" }, NOW)).toEqual({
      status: "finished",
      finishedAt: "2026-09-01T00:00:00.000Z",
      editedAt,
    });
    expect(parseEntryPatch({ deleted: true }, NOW)).toEqual({ deleted: true, editedAt });
  });

  it("keeps when an edit made offline was made (ADR 0042)", () => {
    const editedAt = "2026-09-26T10:00:00.000Z";
    expect(parseEntryPatch({ status: "finished", editedAt }, NOW)).toEqual({ status: "finished", finishedAt: editedAt, editedAt });
    expect(parseEntryPatch({ deleted: true, editedAt }, NOW)).toEqual({ deleted: true, editedAt });
    expect(parseEntryPatch({ rating: 4, review: null, editedAt }, NOW)).toEqual({ notes: { rating: 4, review: null }, editedAt });
    expect(parseEntryPatch({ deleted: true, editedAt: 12 }, NOW)).toBeNull();
  });

  it("accepts a rating and a review, and clears them with null", () => {
    const editedAt = "2026-09-27T20:00:00.000Z";
    expect(parseEntryPatch({ rating: 4.5, review: "  Loved   it \n" }, NOW)).toEqual({ notes: { rating: 4.5, review: "Loved it" }, editedAt });
    expect(parseEntryPatch({ rating: null, review: " " }, NOW)).toEqual({ notes: { rating: null, review: null }, editedAt });
    expect(parseEntryPatch({ rating: 4.25, review: null }, NOW)).toBeNull();
    expect(parseEntryPatch({ rating: 0, review: null }, NOW)).toBeNull();
    expect(parseEntryPatch({ rating: 3 }, NOW)).toBeNull(); // both, so nothing is cleared by accident
    expect(parseEntryPatch({ rating: null, review: "ก".repeat(281) }, NOW)).toBeNull();
  });

  it("takes a game's hours played with the notes, whole hours 1–9999, null to clear (S3 games)", () => {
    const editedAt = "2026-09-27T20:00:00.000Z";
    expect(parseEntryPatch({ rating: 5, review: null, hoursPlayed: 187 }, NOW)).toEqual({ notes: { rating: 5, review: null, hoursPlayed: 187 }, editedAt });
    expect(parseEntryPatch({ rating: null, review: null, hoursPlayed: null }, NOW)).toEqual({ notes: { rating: null, review: null, hoursPlayed: null }, editedAt });
    // Without it, the hours are left as they are.
    expect(parseEntryPatch({ rating: 5, review: null }, NOW)).toEqual({ notes: { rating: 5, review: null }, editedAt });
    for (const hoursPlayed of [0, 10_000, 1.5, "12", -3]) {
      expect(parseEntryPatch({ rating: null, review: null, hoursPlayed }, NOW), String(hoursPlayed)).toBeNull();
    }
  });

  it("rejects bad input", () => {
    expect(parseEntryPatch({}, NOW)).toBeNull();
    expect(parseEntryPatch({ deleted: "yes" }, NOW)).toBeNull();
    expect(parseEntryPatch({ status: "finished", finishedAt: "not a date" }, NOW)).toBeNull();
  });
});

describe("actionTime", () => {
  it("is now when missing, the device's time when sent, clamped to now, and null when bad", () => {
    expect(actionTime(undefined, NOW)).toBe("2026-09-27T20:00:00.000Z");
    expect(actionTime(null, NOW)).toBe("2026-09-27T20:00:00.000Z");
    expect(actionTime("2026-09-20T01:02:03+07:00", NOW)).toBe("2026-09-19T18:02:03.000Z");
    expect(actionTime("2026-09-28T01:00:00Z", NOW)).toBe("2026-09-27T20:00:00.000Z");
    for (const bad of ["2026-09-30T00:00:00Z", "1899-12-31T00:00:00Z", "later", 5, {}]) expect(actionTime(bad, NOW)).toBeNull();
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

describe("finishedAtFor (ADR 0096)", () => {
  it("dates today, yesterday and a picked day in the user's calendar", () => {
    expect(finishedAtFor({ on: "today" }, "Asia/Bangkok", NOW)).toBe("2026-09-27T20:00:00.000Z");
    expect(finishedAtFor({ on: "yesterday" }, "Asia/Bangkok", NOW)).toBe("2026-09-27T05:00:00.000Z");
    expect(finishedAtFor({ on: "yesterday" }, "UTC", NOW)).toBe("2026-09-26T12:00:00.000Z");
    expect(finishedAtFor({ on: "day", date: "2024-05-01" }, "UTC", NOW)).toBe("2024-05-01T12:00:00.000Z");
  });

  it("dates a year alone on 1 January at noon, from 1900 to this year", () => {
    expect(finishedAtFor({ on: "year", year: 2019 }, "Asia/Bangkok", NOW)).toBe("2019-01-01T05:00:00.000Z");
    expect(finishedAtFor({ on: "year", year: 1900 }, "UTC", NOW)).toBe("1900-01-01T12:00:00.000Z");
    expect(finishedAtFor({ on: "year", year: 2026 }, "UTC", NOW)).toBe("2026-01-01T12:00:00.000Z");
    expect(finishedAtFor({ on: "year", year: 2027 }, "UTC", NOW)).toBeNull();
    expect(finishedAtFor({ on: "year", year: 1899 }, "UTC", NOW)).toBeNull();
    expect(finishedAtFor({ on: "year", year: 2019.5 }, "UTC", NOW)).toBeNull();
    expect(finishedAtFor({ on: "day", date: "2026-09-28" }, "UTC", NOW)).toBeNull();
  });
});

describe("isPastFinish (ADR 0096)", () => {
  it("is a finish from before yesterday: a year, or a day two or more days back", () => {
    expect(isPastFinish({ on: "today" }, "UTC", NOW)).toBe(false);
    expect(isPastFinish({ on: "yesterday" }, "UTC", NOW)).toBe(false);
    expect(isPastFinish({ on: "day", date: "2026-09-27" }, "UTC", NOW)).toBe(false);
    expect(isPastFinish({ on: "day", date: "2026-09-26" }, "UTC", NOW)).toBe(false);
    expect(isPastFinish({ on: "day", date: "2026-09-25" }, "UTC", NOW)).toBe(true);
    // 28 Sep in Bangkok: the 26th is two days back there.
    expect(isPastFinish({ on: "day", date: "2026-09-26" }, "Asia/Bangkok", NOW)).toBe(true);
    expect(isPastFinish({ on: "year", year: 2019 }, "UTC", NOW)).toBe(true);
    expect(isPastFinish({ on: "year", year: 2030 }, "UTC", NOW)).toBe(false);
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
