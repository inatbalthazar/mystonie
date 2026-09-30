// The importers' readers (S3 import & export, ADR 0041): Goodreads, MyAnimeList, TV Time and Mystonie's own CSV
// export, detection, and the item rules they share. Fixtures follow each app's real export layout.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { parseExport, wantedInZip } from "./detect";
import { bookTitle, isbnOf, parseGoodreads } from "./goodreads";
import { capItems, dateOf, importItem, importUnit, IMPORT_MAX_ITEMS, mergeItems, momentOf, ratingFromTen, splitYear, type ImportItem } from "./items";
import { parseMal } from "./mal";
import { csvCell, mystonieCsvFiles, parseMystonie, type ExportEntry, type ExportEpisode, type ExportReading } from "./mystonie";
import { parseTvTime } from "./tvtime";
import { crc32, looksLikeGzip, readZipTexts, writeZip } from "./zip";

const fixture = (...path: string[]) => readFileSync(join(__dirname, "fixtures", ...path), "utf8");

describe("items", () => {
  it("reads dates and moments", () => {
    expect(dateOf("2023/05/14")).toBe("2023-05-14");
    expect(dateOf("2023-02-30")).toBeNull();
    expect(dateOf("0000-00-00")).toBeNull();
    expect(momentOf("2021-03-04 21:14:33")).toBe("2021-03-04T21:14:33.000Z");
    expect(momentOf("2021-03-04T21:14:33+07:00")).toBe("2021-03-04T14:14:33.000Z");
    expect(momentOf("2021-03-04")).toBe("2021-03-04T00:00:00.000Z");
    expect(momentOf("yesterday")).toBeNull();
  });

  it("splits the year TheTVDB adds to namesakes, and scores out of ten", () => {
    expect(splitYear("Doctor Who (2005)")).toEqual({ name: "Doctor Who", year: 2005 });
    expect(splitYear("The Office (US)")).toEqual({ name: "The Office (US)", year: null });
    expect(ratingFromTen(9)).toBe(4.5);
    expect(ratingFromTen(0)).toBeNull();
  });

  it("counts in one unit when everything is one kind", () => {
    expect(importUnit(["movie", "movie"])).toBe("film");
    expect(importUnit(["book"])).toBe("book");
    expect(importUnit(["game", "game"])).toBe("game");
    expect(importUnit(["series", "screen"])).toBe("title");
    expect(importUnit(["screen"])).toBe("title");
  });

  it("keeps the most recent items over the limit, finished first", () => {
    const many = Array.from({ length: IMPORT_MAX_ITEMS + 2 }, (_, i) =>
      importItem({
        key: String(i),
        name: `T${i}`,
        find: "movie",
        query: { by: "film", name: `T${i}`, year: null },
        status: "finished",
        watchedOn: `2020-01-${String((i % 28) + 1).padStart(2, "0")}`,
      }),
    );
    const want = importItem({ key: "w", name: "W", find: "movie", query: { by: "film", name: "W", year: null }, status: "want" });
    const { items, cut } = capItems([want, ...many]);
    expect(items).toHaveLength(IMPORT_MAX_ITEMS);
    expect(cut).toBe(3);
    expect(items[0]!.watchedOn).toBe("2020-01-28");
    expect(items.some((i) => i.key === "w")).toBe(false);
  });

  describe("mergeItems", () => {
    const item = (over: Partial<ImportItem>) =>
      importItem({ key: Math.random().toString(), name: "X", find: "series", query: { by: "mal", type: "anime", malId: 1, name: "X" }, status: "finished", ...over });

    it("keeps a series watching while any season is, joining episodes", () => {
      const merged = mergeItems(
        [
          item({ status: "finished", watchedOn: "2020-01-01", rating: 4, episodes: [{ season: 1, episode: 1, watchedAt: "2020-01-01T00:00:00.000Z" }] }),
          item({ status: "watching", episodes: [{ season: 2, episode: 1, watchedAt: "2021-01-01T00:00:00.000Z" }] }),
        ],
        "series",
      );
      expect(merged).toMatchObject({ status: "watching", watchedOn: null, rating: 4 });
      expect(merged.episodes).toHaveLength(2);
    });

    it("finishes a series when every season is, dated and rated by the latest", () => {
      const merged = mergeItems([item({ watchedOn: "2020-01-01", rating: 3 }), item({ watchedOn: "2022-05-05", rating: 5 })], "series");
      expect(merged).toMatchObject({ status: "finished", watchedOn: "2022-05-05", rating: 5 });
      expect(mergeItems([item({ status: "want" }), item({ status: "want" })], "series").status).toBe("want");
    });

    it("finishes a film when any row did", () => {
      expect(mergeItems([item({ status: "want" }), item({ watchedOn: "2020-01-01" })], "movie")).toMatchObject({ status: "finished", watchedOn: "2020-01-01" });
    });
  });
});

describe("Goodreads", () => {
  const text = fixture("goodreads", "goodreads_library_export.csv");

  it("reads the shelves, dates, ratings and ISBNs", () => {
    const parsed = parseGoodreads(text)!;
    expect(parsed.source).toBe("goodreads");
    const byName = Object.fromEntries(parsed.items.map((i) => [i.name, i]));
    expect(byName["The Hunger Games"]).toMatchObject({
      author: "Suzanne Collins",
      year: 2008,
      status: "finished",
      watchedOn: "2023-05-14",
      rating: 5,
      find: "book",
      query: { by: "book", name: "The Hunger Games", author: "Suzanne Collins", isbn: "9780439023481" },
    });
    // No read date: the day it was shelved.
    expect(byName["Dune"]).toMatchObject({ status: "finished", watchedOn: "2019-02-03", rating: null, year: 1965, query: { isbn: "0441172717" } });
    expect(byName["Piranesi"]).toMatchObject({ status: "watching", watchedOn: null, rating: null, query: { isbn: null } });
    expect(byName["Project Hail Mary"]).toMatchObject({ status: "want" });
    // A custom exclusive shelf ("did-not-finish") is left out.
    expect(byName["Abandoned Book"]).toBeUndefined();
    expect(parsed.items.map((i) => i.status)).toEqual(["finished", "finished", "watching", "want"]);
  });

  it("recognises only its own export", () => {
    expect(parseGoodreads("Date,Name,Year\n")).toBeNull();
  });

  it("tidies ISBN formulas and series markers", () => {
    expect(isbnOf('="0439023483"')).toBe("0439023483");
    expect(isbnOf('=""')).toBeNull();
    expect(isbnOf("123")).toBeNull();
    expect(bookTitle("The Hunger Games (The Hunger Games, #1)")).toBe("The Hunger Games");
    expect(bookTitle("Mistborn (Mistborn, #2.5)")).toBe("Mistborn");
    expect(bookTitle("Sapiens (A Brief History)")).toBe("Sapiens (A Brief History)");
  });
});

describe("MyAnimeList", () => {
  const anime = fixture("mal", "animelist.xml");
  const manga = fixture("mal", "mangalist.xml");

  it("reads anime and manga lists together", () => {
    const parsed = parseMal([anime, manga])!;
    expect(parsed.source).toBe("mal");
    const byKey = Object.fromEntries(parsed.items.map((i) => [i.key, i]));
    expect(byKey["mal:anime:1"]).toMatchObject({
      name: "Cowboy Bebop",
      find: "series",
      status: "finished",
      watchedOn: "2021-04-10",
      undated: false,
      rating: 4.5,
      query: { by: "mal", type: "anime", malId: 1, name: "Cowboy Bebop" },
    });
    // Completed without a finish date: the start date; without either, undated.
    expect(byKey["mal:anime:5"]).toMatchObject({ find: "movie", status: "finished", watchedOn: "2020-06-01" });
    expect(byKey["mal:anime:16498"]).toMatchObject({ name: "Shingeki no Kyojin & Friends", status: "finished", watchedOn: null, undated: true });
    expect(byKey["mal:anime:9253"]).toMatchObject({ status: "watching", rating: null });
    expect(byKey["mal:anime:30"]).toMatchObject({ status: "want", find: "screen" });
    // Dropped titles and music videos stay behind.
    expect(byKey["mal:anime:31"]).toBeUndefined();
    expect(byKey["mal:anime:32"]).toBeUndefined();
    // A manga being read, with a start date, brings its chapter as a reading checkpoint that day.
    expect(byKey["mal:manga:2"]).toMatchObject({ find: "manga", status: "watching", reading: [{ unit: "chapter", position: 364, readAt: "2022-03-01T12:00:00.000Z" }] });
    expect(byKey["mal:manga:11"]).toMatchObject({ status: "finished", watchedOn: "2018-12-24", rating: 5, reading: [] });
  });

  it("recognises only a MyAnimeList export", () => {
    expect(parseMal(["<rss></rss>"])).toBeNull();
  });
});

describe("TV Time", () => {
  const files = [
    { path: "tvtime/tracking-prod-records-v2.csv", text: fixture("tvtime", "tracking-prod-records-v2.csv") },
    { path: "tvtime/tracking-prod-records.csv", text: fixture("tvtime", "tracking-prod-records.csv") },
    { path: "tvtime/seen_episode.csv", text: fixture("tvtime", "seen_episode.csv") },
    { path: "tvtime/followed_tv_show.csv", text: fixture("tvtime", "followed_tv_show.csv") },
    { path: "tvtime/access_token.csv", text: "token\nsecret-token\n" },
  ];

  it("reads shows with every episode seen, movies watched or saved, and followed shows", () => {
    const parsed = parseTvTime(files)!;
    expect(parsed.source).toBe("tvtime");
    const byName = Object.fromEntries(parsed.items.map((i) => [`${i.find}:${i.name}`, i]));
    const office = byName["series:The Office"]!;
    expect(office).toMatchObject({ status: "watching", query: { by: "show", name: "The Office", year: null, tvdbId: "73244" } });
    // A rewatch keeps the latest time; specials (season 0) are left out; every file generation is read.
    expect(office.episodes).toEqual([
      { season: 2, episode: 1, watchedAt: "2019-01-01T10:00:00.000Z" },
      { season: 1, episode: 2, watchedAt: "2021-03-04T21:30:00.000Z" },
      { season: 1, episode: 1, watchedAt: "2021-03-05T20:00:00.000Z" },
    ]);
    expect(byName["series:Doctor Who"]).toMatchObject({ year: 2005, status: "watching", query: { tvdbId: "78804" }, episodes: [{ season: 1, episode: 1 }] });
    expect(byName["series:Severance"]).toMatchObject({ status: "want", episodes: [] });
    expect(byName["movie:Inception"]).toMatchObject({
      status: "finished",
      finishedAt: "2020-07-16T19:00:00.000Z",
      year: 2010,
      query: { by: "film", name: "Inception", year: 2010 },
    });
    expect(byName["movie:Dune: Part Two"]).toMatchObject({ status: "want", finishedAt: null });
  });

  it("never opens anything but its show and movie files", () => {
    expect(wantedInZip("tvtime/tracking-prod-records-v2.csv")).toBe(true);
    expect(wantedInZip("tvtime/access_token.csv")).toBe(false);
    expect(wantedInZip("tvtime/ip_address.csv")).toBe(false);
    expect(parseTvTime([{ path: "notes.csv", text: "a\n1\n" }])).toBeNull();
  });
});

describe("Mystonie CSV export", () => {
  const blank = {
    originalName: null,
    year: null,
    originalLanguage: null,
    genres: [],
    finishedAt: null,
    rating: null,
    review: null,
    addedAt: "2025-01-01T00:00:00.000Z",
    hoursPlayed: null,
  };
  const entries: ExportEntry[] = [
    {
      ...blank,
      kind: "movie",
      source: "tmdb",
      externalId: "496243",
      name: "Parasite",
      originalName: "기생충",
      year: 2019,
      originalLanguage: "ko",
      genres: ["Comedy", "Thriller"],
      status: "finished",
      finishedAt: "2024-09-08T12:34:56.000Z",
      rating: 4.5,
      review: '=Loved it, "twice"\nand again',
    },
    { ...blank, kind: "series", source: "tmdb", externalId: "1396", name: "Breaking Bad", year: 2008, status: "watching" },
    { ...blank, kind: "book", source: "google_books", externalId: "abcDEF123_-x", name: "-ology, a book", status: "want" },
    { ...blank, kind: "game", source: "rawg", externalId: "3328", name: "The Witcher 3", status: "finished", finishedAt: "2026-09-20T12:00:00.000Z", hoursPlayed: 187 },
  ];
  const episodes: ExportEpisode[] = [
    { source: "tmdb", externalId: "1396", name: "Breaking Bad", season: 1, episode: 1, runtimeMin: 58, watchedAt: "2025-01-02T20:00:00.000Z" },
    { source: "tmdb", externalId: "1396", name: "Breaking Bad", season: 1, episode: 2, runtimeMin: 48, watchedAt: "2025-01-03T20:00:00.000Z" },
  ];
  const reading: ExportReading[] = [
    { kind: "manga", source: "anilist", externalId: "30002", name: "Berserk", unit: "chapter", position: 120, readAt: "2025-02-02T08:00:00.000Z" },
  ];

  it("guards cells a spreadsheet would run as formulas", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell(4.5)).toBe("4.5");
    expect(csvCell(null)).toBe("");
  });

  it("round-trips: export → import brings every status, time, rating, review and log back", () => {
    const files = mystonieCsvFiles(entries, episodes, reading);
    expect(Object.keys(files)).toEqual(["collection.csv", "episodes.csv", "reading.csv"]);
    expect(files["collection.csv"]!.startsWith("﻿kind,source,external_id,name,")).toBe(true);
    const parsed = parseMystonie(Object.values(files))!;
    expect(parsed.source).toBe("mystonie");
    const byKey = Object.fromEntries(parsed.items.map((i) => [i.key, i]));
    expect(byKey["mystonie:movie:496243"]).toMatchObject({
      name: "Parasite",
      year: 2019,
      status: "finished",
      finishedAt: "2024-09-08T12:34:56.000Z",
      rating: 4.5,
      review: '=Loved it, "twice"\nand again',
      query: { by: "id", kind: "movie", externalId: "496243" },
    });
    expect(byKey["mystonie:series:1396"]).toMatchObject({
      status: "watching",
      episodes: episodes.map(({ season, episode, watchedAt }) => ({ season, episode, watchedAt })),
    });
    expect(byKey["mystonie:book:abcDEF123_-x"]).toMatchObject({ name: "-ology, a book", status: "want", hoursPlayed: null });
    // A game keeps the hours played (S3 games).
    expect(byKey["mystonie:game:3328"]).toMatchObject({ status: "finished", hoursPlayed: 187, query: { by: "id", kind: "game", externalId: "3328" } });
    // Logs of a title no longer in the collection come back as "watching".
    expect(byKey["mystonie:manga:30002"]).toMatchObject({ status: "watching", reading: [{ unit: "chapter", position: 120, readAt: "2025-02-02T08:00:00.000Z" }] });
  });

  it("is found in a ZIP, ahead of the other readers", async () => {
    const zip = writeZip(mystonieCsvFiles(entries, episodes, reading), new Date("2026-09-29T08:00:00Z"));
    const texts = await readZipTexts(zip, wantedInZip, async (b) => inflateRawSync(b));
    const parsed = parseExport([...texts!].map(([path, text]) => ({ path, text })));
    expect(parsed?.source).toBe("mystonie");
    expect(parsed?.items).toHaveLength(5);
  });

  it("still reads a collection file exported before games, without hours played", () => {
    const header = "kind,source,external_id,name,original_name,year,original_language,genres,status,finished_at,rating,review,added_at";
    const old = `\ufeff${header}\r\nmovie,tmdb,496243,Parasite,,2019,ko,,finished,2024-09-08T12:34:56.000Z,4.5,,2024-09-01T00:00:00.000Z\r\n`;
    const parsed = parseMystonie([old])!;
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({ key: "mystonie:movie:496243", status: "finished", rating: 4.5, hoursPlayed: null });
  });
});

describe("parseExport", () => {
  it("tells the sources apart", () => {
    expect(parseExport([{ path: "goodreads_library_export.csv", text: fixture("goodreads", "goodreads_library_export.csv") }])?.source).toBe("goodreads");
    expect(parseExport([{ path: "animelist_1.xml", text: fixture("mal", "animelist.xml") }])?.source).toBe("mal");
    expect(parseExport([{ path: "seen_episode.csv", text: fixture("tvtime", "seen_episode.csv") }])?.source).toBe("tvtime");
    const letterboxd = parseExport([{ path: "diary.csv", text: fixture("letterboxd", "diary.csv") }]);
    expect(letterboxd?.source).toBe("letterboxd");
    expect(letterboxd?.items[0]).toMatchObject({ find: "movie", query: { by: "film" } });
    expect(parseExport([{ path: "notes.csv", text: "a,b\n1,2\n" }])).toBeNull();
  });
});

describe("zip", () => {
  it("writes a stored ZIP that reads back", async () => {
    const files = { "a.csv": "x,y\r\n1,2\r\n", "名前.csv": "ภาษาไทย" };
    const zip = writeZip(files, new Date("2026-09-29T08:00:00Z"));
    const texts = await readZipTexts(zip, () => true, async () => new Uint8Array());
    expect(Object.fromEntries(texts!)).toEqual(files);
  });

  it("computes CRC-32 and spots gzip", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(looksLikeGzip(new Uint8Array([0x1f, 0x8b, 8]))).toBe(true);
    expect(looksLikeGzip(new Uint8Array([0x50, 0x4b]))).toBe(false);
  });
});
