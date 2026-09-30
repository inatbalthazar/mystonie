import { readFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { csvRecords, parseCsv } from "./csv";
import { letterboxdFileOf, parseLetterboxd, LETTERBOXD_MAX_FILMS } from "./letterboxd";
import { looksLikeZip, readZipTexts } from "./zip";

const dir = join(__dirname, "fixtures", "letterboxd");
const sample = ["diary.csv", "watched.csv", "ratings.csv", "watchlist.csv"].map((name) => ({
  path: name,
  text: readFileSync(join(dir, name), "utf8"),
}));

describe("parseCsv", () => {
  it("reads quoted commas, doubled quotes, line breaks inside quotes, CRLF and a BOM", () => {
    expect(parseCsv('﻿a,b,c\r\n"x, y","say ""hi""","two\r\nlines"\r\n\r\nlast,,\n')).toEqual([
      ["a", "b", "c"],
      ["x, y", 'say "hi"', "two\r\nlines"],
      ["last", "", ""],
    ]);
  });

  it("keeps a last row without a line end", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("maps rows to lower-cased headers, filling missing cells", () => {
    expect(csvRecords("Date,Name, Watched Date \n2024-01-01,Heat")).toEqual([{ date: "2024-01-01", name: "Heat", "watched date": "" }]);
    expect(csvRecords("")).toEqual([]);
  });
});

describe("letterboxdFileOf", () => {
  it("knows the export's root files, picked alone or inside the ZIP", () => {
    expect(letterboxdFileOf("diary.csv")).toBe("diary");
    expect(letterboxdFileOf("Watched.CSV")).toBe("watched");
    expect(letterboxdFileOf("ratings.csv")).toBe("ratings");
    expect(letterboxdFileOf("watchlist.csv")).toBe("watchlist");
  });

  it("ignores everything else, including deleted and orphaned copies", () => {
    expect(letterboxdFileOf("deleted/diary.csv")).toBeNull();
    expect(letterboxdFileOf("orphaned/watched.csv")).toBeNull();
    expect(letterboxdFileOf("reviews.csv")).toBeNull();
    expect(letterboxdFileOf("diary.txt")).toBeNull();
    expect(letterboxdFileOf("profile.csv")).toBeNull();
  });
});

describe("parseLetterboxd (a sample export)", () => {
  const result = parseLetterboxd(sample)!;
  const byName = new Map(result.films.map((f) => [f.name, f]));

  it("finds all four files and one row per film, newest watch first, then the watchlist", () => {
    expect(result.files).toEqual(["diary", "watched", "ratings", "watchlist"]);
    expect(result.cut).toBe(0);
    expect(result.films.map((f) => f.name)).toEqual([
      "Parasite",
      'The "Human" Condition',
      "Amélie",
      "Oppenheimer",
      "Dune: Part Two",
      "Crouching Tiger, Hidden Dragon",
      "Past Lives",
      "Home Alone",
      "Spirited Away",
      "The Matrix",
      "Perfect Days",
      "Untitled Film",
    ]);
  });

  it("takes the diary's watched date over the logged date and the watched list", () => {
    expect(byName.get("Parasite")).toMatchObject({ status: "finished", year: 2019, watchedOn: "2024-09-08", rating: 5, watches: 1 });
    expect(byName.get("Past Lives")).toMatchObject({ watchedOn: "2023-06-10", rating: 4.5 });
  });

  it("uses the logged date when a diary row has no watched date", () => {
    expect(byName.get("Amélie")).toMatchObject({ watchedOn: "2024-05-05", rating: null });
  });

  it("keeps the latest watch of a rewatched film, and ratings.csv's rating over the diary's", () => {
    expect(byName.get("Oppenheimer")).toMatchObject({ watchedOn: "2024-03-19", rating: 3.5, watches: 2 });
  });

  it("dates films without a diary entry by when they were marked watched", () => {
    expect(byName.get("Spirited Away")).toMatchObject({ status: "finished", watchedOn: "2021-01-03", rating: 5, watches: 0 });
  });

  it("counts a rated film as watched, dated by its rating", () => {
    expect(byName.get("The Matrix")).toMatchObject({ status: "finished", watchedOn: "2019-05-01", rating: 4 });
  });

  it("imports watchlist-only films as wanted; a watched film on the watchlist is finished", () => {
    expect(byName.get("Perfect Days")).toMatchObject({ status: "want", watchedOn: null, rating: null });
    expect(byName.get("Untitled Film")).toMatchObject({ status: "want", year: null });
    expect(byName.get("Home Alone")).toMatchObject({ status: "finished", watchedOn: "2022-12-24" });
  });

  it("reads quoted names", () => {
    expect(byName.get("Crouching Tiger, Hidden Dragon")).toMatchObject({ year: 2000, watchedOn: "2024-02-14", rating: 5 });
    expect(byName.has('The "Human" Condition')).toBe(true);
  });
});

describe("parseLetterboxd (edge cases)", () => {
  it("is null without any export file", () => {
    expect(parseLetterboxd([{ path: "reviews.csv", text: "Date,Name\n" }])).toBeNull();
    expect(parseLetterboxd([])).toBeNull();
  });

  it("works with the diary alone", () => {
    const r = parseLetterboxd([sample[0]!])!;
    expect(r.files).toEqual(["diary"]);
    expect(r.films).toHaveLength(7);
  });

  it("drops rows without a name, bad ratings and years, and finished films with no date", () => {
    const r = parseLetterboxd([
      {
        path: "diary.csv",
        text: [
          "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date",
          "2024-01-01,,2020,u,4,,,2024-01-01",
          "2024-01-02,Heat,19x5,u,4.3,,,2024-01-02",
          "not-a-date,Undated,2001,u,3,,,2024-02-30",
        ].join("\n"),
      },
    ])!;
    expect(r.films).toEqual([{ key: "Heat\u0000", name: "Heat", year: null, status: "finished", watchedOn: "2024-01-02", rating: null, watches: 1 }]);
  });

  it("keeps the newest films when an export is too big", () => {
    const rows = Array.from({ length: LETTERBOXD_MAX_FILMS + 2 }, (_, i) => `2020-01-01,Film ${i},2000,u`);
    const r = parseLetterboxd([{ path: "watched.csv", text: ["Date,Name,Year,Letterboxd URI", ...rows].join("\n") }])!;
    expect(r.films).toHaveLength(LETTERBOXD_MAX_FILMS);
    expect(r.cut).toBe(2);
  });
});

/** A ZIP archive the way Letterboxd's export (and most zippers) write one: deflated entries + a central directory. */
function zip(files: { name: string; text: string; store?: boolean }[]): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const raw = Buffer.from(f.text, "utf8");
    const data = f.store ? raw : deflateRawSync(raw);
    const name = Buffer.from(f.name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(f.store ? 0 : 8, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(f.store ? 0 : 8, 10);
    central.writeUInt32LE(crc32(raw), 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, data);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, dir, end]));
}

const inflate = async (bytes: Uint8Array) => new Uint8Array(inflateRawSync(bytes));

describe("readZipTexts", () => {
  it("reads the wanted files of an export ZIP, deflated or stored", async () => {
    const bytes = zip([
      { name: "profile.csv", text: "Date,Username\n" },
      ...sample.map((f, i) => ({ name: f.path, text: f.text, store: i === 3 })),
      { name: "deleted/diary.csv", text: "Date,Name\n2020-01-01,Gone\n" },
      { name: "lists/", text: "" },
    ]);
    expect(looksLikeZip(bytes)).toBe(true);
    const texts = await readZipTexts(bytes, (p) => letterboxdFileOf(p) !== null, inflate);
    expect([...texts!.keys()]).toEqual(["diary.csv", "watched.csv", "ratings.csv", "watchlist.csv"]);
    const films = parseLetterboxd([...texts!].map(([path, text]) => ({ path, text })));
    expect(films).toEqual(parseLetterboxd(sample));
  });

  it("is null for something that isn't a ZIP", async () => {
    const csv = new TextEncoder().encode(sample[0]!.text);
    expect(looksLikeZip(csv)).toBe(false);
    expect(await readZipTexts(csv, () => true, inflate)).toBeNull();
  });

  it("skips an entry that doesn't inflate", async () => {
    const bytes = zip([
      { name: "diary.csv", text: sample[0]!.text },
      { name: "watched.csv", text: sample[1]!.text },
    ]);
    let calls = 0;
    const flaky = async (b: Uint8Array) => {
      if (calls++ === 0) throw new Error("corrupt");
      return inflate(b);
    };
    const texts = await readZipTexts(bytes, () => true, flaky);
    expect([...texts!.keys()]).toEqual(["watched.csv"]);
  });
});
