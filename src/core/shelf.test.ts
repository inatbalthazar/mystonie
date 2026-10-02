import { describe, expect, it } from "vitest";
import { parseShelfPins, SHELF_PINS_MAX, shelfItems, type ShelfTitle } from "./shelf";
import type { StatsEntry } from "./stats/summary";

const title = (id: string, kind: ShelfTitle["kind"] = "movie"): ShelfTitle => ({ id, kind, name: id.toUpperCase(), posterUrl: null });
const entry = (titleId: string, finishedAt: string | null, extra: Partial<StatsEntry> = {}): StatsEntry => ({
  id: `e-${titleId}`,
  titleId,
  status: finishedAt ? "finished" : "watching",
  finishedAt,
  ...extra,
});

describe("shelfItems", () => {
  const titles = [title("a"), title("b", "book"), title("c", "series"), title("d", "manga"), title("e")];
  const entries = [
    entry("a", "2026-09-01T10:00:00Z"),
    entry("b", "2026-09-03T10:00:00Z"),
    entry("c", "2026-09-02T10:00:00Z"),
    entry("d", null),
    entry("e", "2026-09-04T10:00:00Z", { deletedAt: "2026-09-05T10:00:00Z" }),
  ];

  it("lists live finishes, newest first", () => {
    expect(shelfItems(titles, entries, 10)).toEqual({ items: [titles[1], titles[2], titles[0]], pinned: 0, more: 0 });
  });

  it("stops at max and counts the rest", () => {
    expect(shelfItems(titles, entries, 2)).toEqual({ items: [titles[1], titles[2]], pinned: 0, more: 1 });
  });

  it("breaks ties by title id", () => {
    const same = [entry("c", "2026-09-01T10:00:00Z"), entry("a", "2026-09-01T10:00:00Z")];
    expect(shelfItems(titles, same, 5).items.map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("puts the pinned favourites first, in pin order (ADR 0069)", () => {
    expect(shelfItems(titles, entries, 10, ["a", "c"])).toEqual({ items: [titles[0], titles[2], titles[1]], pinned: 2, more: 0 });
  });

  it("drops pins that aren't live finishes, and an old favourite still makes the cut", () => {
    // d is still watching, e was deleted, x isn't in the collection; a is the oldest finish but pinned.
    expect(shelfItems(titles, entries, 2, ["d", "e", "x", "a"])).toEqual({ items: [titles[0], titles[1]], pinned: 1, more: 1 });
  });
});

describe("parseShelfPins", () => {
  const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

  it("takes up to four title ids and drops repeats", () => {
    expect(parseShelfPins([])).toEqual([]);
    expect(parseShelfPins([id(1), id(2), id(1)])).toEqual([id(1), id(2)]);
    expect(parseShelfPins([1, 2, 3, 4].map(id))).toHaveLength(SHELF_PINS_MAX);
  });

  it("rejects anything else", () => {
    expect(parseShelfPins([1, 2, 3, 4, 5].map(id))).toBeNull();
    expect(parseShelfPins(["not-a-uuid"])).toBeNull();
    expect(parseShelfPins(["0000000A-0000-4000-8000-00000000000B"])).toBeNull();
    expect(parseShelfPins(id(1))).toBeNull();
    expect(parseShelfPins([null])).toBeNull();
  });
});
