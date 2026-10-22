import { describe, expect, it } from "vitest";
import { markDone, moveItem, moveToTier, parseRanking, parseRef, placeInTier, remixRanking, removeTier, shiftInTier, tierPosterHeight, tierRows, titleRef } from "./rankings";

const POSTER = "https://image.tmdb.org/t/p/w342/abc.jpg";
const dune = { ref: "tmdb:movie:438631", kind: "movie", name: "Dune", year: 2021, posterUrl: POSTER };

describe("refs (ADR 0099)", () => {
  it("names titles by their catalog", () => {
    expect(titleRef("movie", "603")).toBe("tmdb:movie:603");
    expect(titleRef("book", "abcdefghijkl")).toBe("google_books:book:abcdefghijkl");
    expect(titleRef("game", "3498")).toBe("rawg:game:3498");
  });

  it("parses titles, countries and regions", () => {
    expect(parseRef("anilist:manga:30013")).toEqual({ type: "title", kind: "manga", externalId: "30013" });
    expect(parseRef("country:JP")).toEqual({ type: "country", code: "JP" });
    expect(parseRef("region:TH-10")).toEqual({ type: "region", id: "TH-10", country: "TH" });
  });

  it("refuses the wrong catalog, unknown places and junk", () => {
    expect(parseRef("rawg:movie:603")).toBeNull();
    expect(parseRef("tmdb:movie:abc")).toBeNull();
    expect(parseRef("country:XX")).toBeNull();
    expect(parseRef("region:th-10")).toBeNull();
    expect(parseRef(42)).toBeNull();
  });
});

describe("parseRanking", () => {
  it("keeps a valid list, trimmed, with done off until the server says", () => {
    expect(parseRanking({ items: [{ ...dune, name: " Dune ", note: " best sand ", done: true }, { ref: "country:JP", kind: "country", name: "Japan" }] })).toEqual({
      items: [
        { ...dune, note: "best sand", done: true },
        { ref: "country:JP", kind: "country", name: "Japan", year: null, posterUrl: null, note: null, done: false },
      ],
    });
  });

  it("is absent when there is none", () => {
    expect(parseRanking(undefined)).toBeNull();
    expect(parseRanking(null)).toBeNull();
  });

  it("refuses empty or long lists, repeats and mismatches", () => {
    expect(parseRanking({ items: [] })).toBeUndefined();
    expect(parseRanking({ items: Array.from({ length: 11 }, (_, i) => ({ ref: `tmdb:movie:${i + 1}`, kind: "movie", name: `M${i}` })) })).toBeUndefined();
    expect(parseRanking({ items: [dune, dune] })).toBeUndefined();
    expect(parseRanking({ items: [{ ...dune, kind: "series" }] })).toBeUndefined();
    expect(parseRanking({ items: [{ ...dune, posterUrl: "https://evil.example/x.jpg" }] })).toBeUndefined();
    expect(parseRanking({ items: [{ ref: "country:JP", kind: "country", name: "Japan", posterUrl: POSTER }] })).toBeUndefined();
    expect(parseRanking({ items: [{ ...dune, note: "x".repeat(61) }] })).toBeUndefined();
  });
});

describe("markDone", () => {
  it("ticks what was finished or been to, and nothing else", () => {
    const ranking = {
      items: [
        { ref: "tmdb:movie:438631", kind: "movie" as const, name: "Dune", done: true },
        { ref: "tmdb:movie:1", kind: "movie" as const, name: "Other", done: true },
        { ref: "country:JP", kind: "country" as const, name: "Japan" },
        { ref: "region:TH-10", kind: "region" as const, name: "Bangkok" },
      ],
    };
    const done = markDone(ranking, new Set(["tmdb:movie:438631"]), new Set(["JP"])).items.map((i) => i.done);
    expect(done).toEqual([true, false, true, false]);
  });
});

describe("moveItem", () => {
  it("moves one item, clamped", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 0, 9)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});

describe("tier lists (ADR 0099, step 2)", () => {
  const items = [
    { ref: "tmdb:movie:1", kind: "movie", name: "One", tier: 0 },
    { ref: "tmdb:movie:2", kind: "movie", name: "Two", tier: 2 },
    { ref: "country:JP", kind: "country", name: "Japan", tier: 0 },
  ];

  it("keeps the rows and each item's row", () => {
    const ranking = parseRanking({ items, tiers: [" S ", "A", "B"] });
    expect(ranking?.tiers).toEqual(["S", "A", "B"]);
    expect(ranking?.items.map((i) => i.tier)).toEqual([0, 2, 0]);
  });

  it("refuses rows out of range, odd labels and a row on a top list", () => {
    expect(parseRanking({ items, tiers: ["S", "A"] })).toBeUndefined();
    expect(parseRanking({ items, tiers: [] })).toBeUndefined();
    expect(parseRanking({ items, tiers: ["S", "A", "B", "C", "D", "E", "F"] })).toBeUndefined();
    expect(parseRanking({ items, tiers: ["S", "A", "Thirteen chars"] })).toBeUndefined();
    expect(parseRanking({ items: [{ ...items[0] }] })).toBeUndefined();
  });

  it("takes up to 30 things", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ref: `tmdb:movie:${i + 1}`, kind: "movie", name: `M${i}`, tier: i % 5 }));
    expect(parseRanking({ items: many, tiers: ["S", "A", "B", "C", "D"] })?.items).toHaveLength(30);
    expect(parseRanking({ items: [...many, { ref: "tmdb:movie:99", kind: "movie", name: "X", tier: 0 }], tiers: ["S", "A", "B", "C", "D"] })).toBeUndefined();
  });

  it("lists the rows with items, in order, and keeps them through the ✓ marks", () => {
    const ranking = parseRanking({ items, tiers: ["S", "A", "B"] })!;
    expect(tierRows(ranking).map((r) => [r.label, r.items.map((i) => i.name)])).toEqual([
      ["S", ["One", "Japan"]],
      ["B", ["Two"]],
    ]);
    expect(markDone(ranking, new Set(), new Set(["JP"])).tiers).toEqual(["S", "A", "B"]);
  });

  it("sizes posters to fit, wrapping long rows", () => {
    expect(tierPosterHeight([3, 2], 800, 1000, 12, 300)).toBe(300);
    const h = tierPosterHeight([20, 5, 5], 800, 900, 12, 300);
    expect(h).toBeLessThan(300);
    const perLine = Math.floor((800 + 12) / ((h * 2) / 3 + 12));
    const lines = Math.ceil(20 / perLine) + 2;
    expect(lines * h + (lines - 1) * 12).toBeLessThanOrEqual(900);
  });

  const row = (list: { ref: string; tier?: number }[]) => list.map((i) => `${i.ref.split(":")[2] ?? i.ref}@${i.tier}`);
  const list = [
    { ref: "tmdb:movie:1", kind: "movie" as const, name: "1", tier: 0 },
    { ref: "tmdb:movie:2", kind: "movie" as const, name: "2", tier: 1 },
    { ref: "tmdb:movie:3", kind: "movie" as const, name: "3", tier: 0 },
  ];

  it("moves an item to the end of another row", () => {
    expect(row(moveToTier(list, "tmdb:movie:1", 1))).toEqual(["2@1", "3@0", "1@1"]);
    expect(row(moveToTier(list, "tmdb:movie:1", 0))).toEqual(["1@0", "2@1", "3@0"]);
  });

  it("shifts within a row, past the next item of that row only", () => {
    expect(row(shiftInTier(list, "tmdb:movie:3", -1))).toEqual(["3@0", "2@1", "1@0"]);
    expect(row(shiftInTier(list, "tmdb:movie:3", 1))).toEqual(["1@0", "2@1", "3@0"]);
    expect(row(shiftInTier(list, "tmdb:movie:2", -1))).toEqual(["1@0", "2@1", "3@0"]);
  });

  it("places a dragged item before another in a row, or at a row's end (ADR 0100)", () => {
    expect(row(placeInTier(list, "tmdb:movie:3", 0, "tmdb:movie:1"))).toEqual(["3@0", "1@0", "2@1"]);
    expect(row(placeInTier(list, "tmdb:movie:1", 1, "tmdb:movie:2"))).toEqual(["1@1", "2@1", "3@0"]);
    expect(row(placeInTier(list, "tmdb:movie:1", 1, null))).toEqual(["2@1", "1@1", "3@0"]);
    expect(row(placeInTier(list, "tmdb:movie:2", 0, null))).toEqual(["1@0", "3@0", "2@0"]);
    // Onto an empty row, and "before" an item of another row: its end.
    expect(row(placeInTier(list, "tmdb:movie:1", 2, null))).toEqual(["2@1", "3@0", "1@2"]);
    expect(row(placeInTier(list, "tmdb:movie:2", 0, "tmdb:movie:2"))).toEqual(["1@0", "2@1", "3@0"]);
    // Nothing moves: the same list back.
    expect(placeInTier(list, "tmdb:movie:3", 0, null)).toBe(list);
    expect(placeInTier(list, "tmdb:movie:1", 0, "tmdb:movie:3")).toBe(list);
    expect(placeInTier(list, "tmdb:movie:9", 0, null)).toBe(list);
  });

  it("removes only an empty row, moving the rows below up", () => {
    const removed = removeTier({ items: list, tiers: ["S", "Mid", "A"] }, 1);
    expect(removed.tiers).toEqual(["S", "Mid", "A"]);
    const empty = removeTier({ items: [{ ...list[0]!, tier: 2 }], tiers: ["S", "A", "B"] }, 1);
    expect(empty.tiers).toEqual(["S", "B"]);
    expect(empty.items[0]!.tier).toBe(1);
    expect(removeTier({ items: [], tiers: ["S"] }, 0).tiers).toEqual(["S"]);
  });
});

describe("remixRanking (step 4)", () => {
  it("keeps the things, their order and rows, but not the maker's marks or lines", () => {
    const shared = parseRanking({ items: [{ ...dune, note: "sand", done: true, tier: 1 }], tiers: ["S", "A"] })!;
    expect(remixRanking(shared)).toEqual({ items: [{ ref: dune.ref, kind: "movie", name: "Dune", year: 2021, posterUrl: POSTER, tier: 1 }], tiers: ["S", "A"] });
    expect(remixRanking(parseRanking({ items: [dune] })!).tiers).toBeUndefined();
  });
});
